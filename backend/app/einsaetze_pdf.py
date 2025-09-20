import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors


def create_einsaetze_pdf(einsaetze_list, filtered_teams=None):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    title = Paragraph("Einsätze Übersicht", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))

    # Overview of filtered teams at the top
    if filtered_teams:
        overview_text = "Für folgende Teams wurde die Übersicht erstellt: " + ", ".join(filtered_teams)
        elements.append(Paragraph(overview_text, styles['Normal']))
        elements.append(Spacer(1, 12))

    # Table header
    data = [["Zeit", "Teams", "Liga", "Beteiligung"]]
    schiedsrichter_rows = []
    for idx, einsatz in enumerate(einsaetze_list):
        involved = einsatz.get('involved', '')
        # Replace with colored text labels
        parts = []
        for part in involved.split(','):
            part = part.strip()
            if '(Spieler)' in part:
                label = part.replace('(Spieler)', '').strip()
                parts.append('<font color="blue">Spieler: {}</font>'.format(label))
            elif '(SR)' in part:
                label = part.replace('(SR)', '').strip()
                parts.append('<font color="orange">SR: {}</font>'.format(label))
        involved_label = ', '.join(parts) if parts else involved
        row = [
            einsatz.get('date', ''),
            einsatz.get('teams', ''),
            einsatz.get('liga', ''),
            Paragraph(involved_label, styles['Normal'])
        ]
        data.append(row)
        # Highlight Schiedsrichter rows
        if 'SR:' in involved_label:
            schiedsrichter_rows.append(idx + 1)  # +1 for header

    table = Table(data, repeatRows=1)
    row_backgrounds = [colors.whitesmoke, colors.lightgrey]
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]
    for i in range(1, len(data)):
        style.append(('BACKGROUND', (0, i), (-1, i), row_backgrounds[(i-1)%2]))
    for i in schiedsrichter_rows:
        style.append(('BACKGROUND', (0, i), (-1, i), colors.yellow))
    table.setStyle(TableStyle(style))
    elements.append(table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
