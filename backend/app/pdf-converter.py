from tempfile import NamedTemporaryFile
import os
import subprocess
import io

def excel_to_pdf(excel_bytes):
    """Convert Excel bytes to PDF bytes using LibreOffice"""

    # Create temporary Excel file
    with NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
        temp_excel.write(excel_bytes)
        temp_excel.flush()
        excel_path = temp_excel.name

    try:
        # Create temporary directory for output
        temp_dir = os.path.dirname(excel_path)

        # Convert Excel to PDF using LibreOffice
        result = subprocess.run([
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', temp_dir, excel_path
        ], capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            raise Exception(f"LibreOffice conversion failed: {result.stderr}")

        # Read the generated PDF
        pdf_path = excel_path.replace('.xlsx', '.pdf')
        if not os.path.exists(pdf_path):
            raise Exception("PDF file was not created")

        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

        # Cleanup
        os.unlink(pdf_path)

        return pdf_bytes

    except Exception as e:
        raise Exception(f"PDF conversion failed: {str(e)}")
    finally:
        # Cleanup Excel file
        if os.path.exists(excel_path):
            os.unlink(excel_path)

def excel_to_pdf_alternative(excel_bytes):
    """Alternative PDF conversion using openpyxl and reportlab (if LibreOffice not available)"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors

        # Create temporary Excel file
        with NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_bytes)
            temp_excel.flush()
            wb = load_workbook(temp_excel.name)
            ws = wb.active

        # Create PDF buffer
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()

        # Add title
        title = Paragraph("Spielberichtsbogen", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 12))

        # Extract key information from Excel
        data = []
        for row in ws.iter_rows(min_row=1, max_row=25, values_only=True):
            if any(cell is not None for cell in row):
                # Filter out empty cells and format row
                formatted_row = [str(cell) if cell is not None else "" for cell in row[:6]]
                if any(formatted_row):
                    data.append(formatted_row)

        # Create table
        if data:
            table = Table(data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(table)

        # Build PDF
        doc.build(story)
        pdf_buffer.seek(0)

        # Cleanup
        os.unlink(temp_excel.name)

        return pdf_buffer.read()

    except ImportError:
        # Fallback: return original Excel as "PDF"
        return excel_bytes
    except Exception as e:
        raise Exception(f"Alternative PDF conversion failed: {str(e)}")
