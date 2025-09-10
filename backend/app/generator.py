import pandas as pd
from openpyxl import load_workbook
from tempfile import NamedTemporaryFile
import os
import io

def read_spielplan(file_bytes):
    """Read spielplan from Excel bytes"""
    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name='Ergebnisse')
    return df

def create_spielbericht(match, template_bytes):
    """Create a single match report with improved exception resilience"""
    tf = None
    tmp_out = None
    result_bytes = None
    try:
        tf = NamedTemporaryFile(delete=False, suffix='.xlsx')
        tf.write(template_bytes)
        tf.flush()
        try:
            wb = load_workbook(tf.name)
            ws = wb.active
        except Exception as e:
            print(f"Error loading workbook: {e}")
            return None

        # Extract match data with error handling
        try:
            no = match.get('id', "")
            startzeit = match.get('Startzeit', "")
            datum = match.get('Tag', "")
            spielfeld = match.get('Feld', "")
            liga = match.get('Liga', "")
            team1 = match.get('Team 1', "")
            team2 = match.get('Team 2', "")
            schiedsrichter1 = match.get('Schiedsrichter', "")
            schiedsrichter2 = match.get('Schiedsrichter 2', "")
            if pd.isna(schiedsrichter2):
                schiedsrichter2 = ""
        except Exception as e:
            print(f"Error extracting match data: {e}")
            return None

        def safe_set_cell(row, col, value):
            try:
                cell = ws.cell(row, col)
                if hasattr(cell, 'value'):
                    cell.value = value
            except Exception as e:
                print(f"Error setting cell ({row},{col}): {e}")

        # Replace template teams with actual teams
        for row in range(1, ws.max_row + 1):
            if row > 40:
                break
            for col in range(1, ws.max_column + 1):
                try:
                    val = ws.cell(row, col).value
                    if val == "$HEIM":
                        safe_set_cell(row, col, team1)
                    elif val == "$GEGNER":
                        safe_set_cell(row, col, team2)
                    elif val == "$SCHIRI":
                        safe_set_cell(row, col, schiedsrichter1)
                    elif val == "$SCHIRI2":
                        safe_set_cell(row, col, schiedsrichter2)
                    elif val == "$DATE":
                        safe_set_cell(row, col, datum)
                    elif val == "$TIME":
                        safe_set_cell(row, col, startzeit)
                    elif val == "$FIELD":
                        safe_set_cell(row, col, spielfeld)
                    elif val == "$LIGA":
                        safe_set_cell(row, col, liga)
                    elif val == "$NO":
                        safe_set_cell(row, col, no)
                except Exception as e:
                    print(f"Error replacing placeholder at ({row},{col}): {e}")
                    continue

        # Save to temporary file and return bytes
        try:
            tmp_out = NamedTemporaryFile(delete=False, suffix='.xlsx')
            wb.save(tmp_out.name)
            tmp_out.flush()
            with open(tmp_out.name, 'rb') as f:
                result_bytes = f.read()
        except Exception as e:
            print(f"Error saving or reading output file: {e}")
            return None

        return result_bytes
    except Exception as e:
        print(f"General error in create_spielbericht: {e}")
        return None
    finally:
        # Cleanup temp files
        if tf is not None:
            try:
                os.unlink(tf.name)
            except Exception as e:
                print(f"Error cleaning up temp file {tf.name}: {e}")
        if tmp_out is not None:
            try:
                os.unlink(tmp_out.name)
            except Exception as e:
                print(f"Error cleaning up temp file {tmp_out.name}: {e}")
