from .util import clean_json, find_placeholders_in_template
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from .generator import read_spielplan, create_spielbericht
from .pdf_converter import excel_to_pdf
import io
import zipfile
from typing import List
import numpy as np
import json
import pandas as pd

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="frontend"), name="static")
templates = Jinja2Templates(directory="frontend")

spielplan_bytes = None
template_bytes = None
spielplan_df = None
template_placeholders = None

@app.get("/")
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/upload")
async def upload_files(
    spielplan: UploadFile = File(...),
    template: UploadFile = File(...)
):
    global spielplan_bytes, template_bytes, spielplan_df, template_placeholders

    print("Upload endpoint called")
    try:
        # Validate file types
        if not spielplan.filename.endswith('.xlsx'):
            return JSONResponse(status_code=400, content={"success": False, "detail": "Spielplan must be an Excel file (.xlsx)"})
        if not template.filename.endswith('.xlsx'):
            return JSONResponse(status_code=400, content={"success": False, "detail": "Template must be an Excel file (.xlsx)"})

        spielplan_bytes = await spielplan.read()
        template_bytes = await template.read()
        spielplan_df = read_spielplan(spielplan_bytes)
        template_placeholders = find_placeholders_in_template(template_bytes)

        print("Spielplan read successfully")
        # Replace NaN and infinite values with None
        spielplan_df = spielplan_df.replace([np.inf, -np.inf], np.nan)
        spielplan_df = spielplan_df.where(pd.notnull(spielplan_df), None)

        # Add index for frontend
        matches = spielplan_df.reset_index().to_dict(orient='records')
        for i, match in enumerate(matches):
            match['id'] = i + 1

        # Clean all matches for JSON serialization
        matches = clean_json(matches)

        print(f"Successfully loaded {len(matches)} matches")
        for match in matches:
            print(f"Match {match['id']}: {match['Team 1']} vs {match['Team 2']}")
        print("First match dict:", matches[0] if matches else None)
        # Try serializing to JSON early to catch errors
        try:
            json.dumps(matches)
        except Exception as json_err:
            print("JSON serialization error:", json_err)
            return JSONResponse(status_code=500, content={"success": False, "detail": f"JSON serialization error: {str(json_err)}"})

        print("Returning success response from /api/upload")
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "matches": matches,
                "count": len(matches),
                "message": f"Successfully loaded {len(matches)} matches"
            }
        )
    except Exception as e:
        import traceback
        print("Exception in upload_files:", e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"success": False, "detail": f"Error processing files: {str(e)}"})

@app.get("/api/matches")
def get_matches():
    print("Get matches endpoint called")
    global spielplan_df
    if spielplan_df is not None:
        # Replace NaN and infinite values with None
        df = spielplan_df.replace([np.inf, -np.inf], np.nan)
        df = df.where(pd.notnull(df), None)
        matches = df.reset_index().to_dict(orient='records')
        for i, match in enumerate(matches):
            match['id'] = i
        return {"success": True, "matches": matches, "count": len(matches)}
    else:
        return {"success": False, "message": "No matches loaded. Please upload files first."}
@app.post("/api/generate")
async def generate_reports(match_ids: List[int]):
    global spielplan_df, template_bytes

    if spielplan_df is None or template_bytes is None:
        raise HTTPException(status_code=400, detail="Please upload files first")

    try:
        if len(match_ids) == 1:
            # Single match - return PDF directly
            match_id = match_ids[0]
            if not (0 <= match_id < len(spielplan_df)):
                raise HTTPException(status_code=400, detail="Invalid match ID")

            match = spielplan_df.iloc[match_id]
            excel_bytes = create_spielbericht(match, template_bytes, template_placeholders)
            pdf_bytes = excel_to_pdf(excel_bytes)

            filename = f"spielbericht_{match_id+1}_{match['Team 1']}_vs_{match['Team 2']}.pdf"
            filename = filename.replace(" ", "_").replace("/", "_")

            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type='application/pdf',
                headers={'Content-Disposition': f'attachment; filename={filename}'}
            )
        else:
            # Multiple matches - return ZIP with PDFs
            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for match_id in match_ids:
                    if not (0 <= match_id < len(spielplan_df)):
                        continue

                    match = spielplan_df.iloc[match_id]
                    excel_bytes = create_spielbericht(match, template_bytes, template_placeholders)
                    pdf_bytes = excel_to_pdf(excel_bytes)

                    filename = f"spielbericht_{match_id+1}_{match['Team 1']}_vs_{match['Team 2']}.pdf"
                    filename = filename.replace(" ", "_").replace("/", "_")

                    zip_file.writestr(filename, pdf_bytes)

            zip_buffer.seek(0)

            return StreamingResponse(
                io.BytesIO(zip_buffer.read()),
                media_type='application/zip',
                headers={'Content-Disposition': 'attachment; filename=spielberichte.zip'}
            )

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": f"Error generating reports: {str(e)}"})
@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Spielbericht Generator API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)