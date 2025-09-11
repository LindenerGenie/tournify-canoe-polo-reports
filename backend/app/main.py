from .util import clean_json, find_placeholders_in_template, read_players_by_team
import io
from typing import List
import json
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from .generator import read_spielplan, create_spielbericht
from .pdf_converter import excel_to_pdf
import pandas as pd
import os
import subprocess

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="frontend"), name="static")
templates = Jinja2Templates(directory="frontend")

spielplan_bytes = None
template_bytes = None
spielplan_df = None
template_placeholders = None
players_by_team = None

@app.get("/")
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/upload")
async def upload_files(
    spielplan: UploadFile = File(...),
    players: UploadFile = File(None)
):
    global spielplan_bytes, template_bytes, spielplan_df, template_placeholders, players_by_team

    print("Upload endpoint called")
    try:
        # Validate file types
        if not spielplan.filename.endswith('.xlsx'):
            return JSONResponse(status_code=400, content={"success": False, "detail": "Spielplan must be an Excel file (.xlsx)"})

        spielplan_bytes = await spielplan.read()
        # Read template from file system
        with open("/app/assets/template.xlsx", "rb") as f:
            template_bytes = f.read()
        spielplan_df = read_spielplan(spielplan_bytes)
        template_placeholders = find_placeholders_in_template(template_bytes)

        # Handle players file if provided
        if players is not None:
            players_bytes = await players.read()
            players_by_team = read_players_by_team(players_bytes)
            print("Players loaded:", players_by_team)
        else:
            players_by_team = None

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
                "players": players_by_team,
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
    global spielplan_df, template_bytes, template_placeholders, players_by_team

    print(f"generate_reports called with match_ids: {match_ids}")
    if spielplan_df is None or template_bytes is None or template_placeholders is None:
        print("Error: Required data not uploaded yet.")
        raise HTTPException(status_code=400, detail="Please upload files first")

    try:
        if len(match_ids) == 1:
            print("Generating report for a single match.")
            match_id = match_ids[0]
            print(f"Single match_id: {match_id}")
            if not (0 <= match_id < len(spielplan_df)):
                print(f"Invalid match ID: {match_id}")
                raise HTTPException(status_code=400, detail="Invalid match ID")

            match = spielplan_df.iloc[match_id]
            print(f"Match data: {match}")
            excel_bytes = create_spielbericht(match, template_bytes, template_placeholders, players_by_team)
            print("Excel bytes for match created.")
            pdf_bytes = excel_to_pdf(excel_bytes)
            print("PDF bytes for match created.")

            filename = f"spielbericht_{match_id+1}_{match['Team 1']}_vs_{match['Team 2']}.pdf"
            filename = filename.replace(" ", "_").replace("/", "_")
            print(f"PDF filename: {filename}")

            print("Returning single PDF as StreamingResponse.")
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type='application/pdf',
                headers={'Content-Disposition': f'attachment; filename={filename}'}
            )
        else:
            print("Generating reports for multiple matches.")

            pdf_dir = "/app/generated_pdfs"
            os.makedirs(pdf_dir, exist_ok=True)
            pdf_paths = []

            for match_id in match_ids:
                print(f"Processing match_id: {match_id}")
                if not (0 <= match_id < len(spielplan_df)):
                    print(f"Skipping invalid match ID: {match_id}")
                    continue

                match = spielplan_df.iloc[match_id]
                print(f"Match data: {match}")
                excel_bytes = create_spielbericht(match, template_bytes, template_placeholders, players_by_team)
                print("Excel bytes for match created.")
                pdf_bytes = excel_to_pdf(excel_bytes)
                print("PDF bytes for match created.")

                filename = f"spielbericht_{match_id+1}_{match['Team 1']}_vs_{match['Team 2']}.pdf"
                filename = filename.replace(" ", "_").replace("/", "_")
                pdf_path = os.path.join(pdf_dir, filename)
                with open(pdf_path, "wb") as f:
                    f.write(pdf_bytes)
                pdf_paths.append(pdf_path)
                print(f"Saved PDF for match_id: {match_id} to {pdf_path}")

            merged_pdf_path = os.path.join(pdf_dir, "spielberichte_merged.pdf")
            merge_cmd = ["pdfunite"] + pdf_paths + [merged_pdf_path]
            print(f"Merging PDFs with command: {' '.join(merge_cmd)}")
            try:
                subprocess.run(merge_cmd, check=True)
            except Exception as e:
                print(f"Error merging PDFs: {e}")
                raise HTTPException(status_code=500, detail="Failed to merge PDFs")

            with open(merged_pdf_path, "rb") as f:
                merged_pdf_bytes = f.read()

            print("Returning merged PDF as StreamingResponse.")
            return StreamingResponse(
                io.BytesIO(merged_pdf_bytes),
                media_type='application/pdf',
                headers={'Content-Disposition': 'attachment; filename=spielberichte.pdf'}
            )

    except Exception as e:
        import traceback
        print("Exception in generate_reports:", e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"success": False, "message": f"Error generating reports: {str(e)}"})

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Spielbericht Generator API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
