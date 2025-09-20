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

    # Modern color scheme
    PRIMARY = colors.HexColor('#1976d2')      # blue
    ACCENT = colors.HexColor('#43a047')       # green
    WARNING = colors.HexColor('#ffa726')      # orange
    BG_HEADER = colors.HexColor('#e3f2fd')    # light blue
    BG_ROW1 = colors.HexColor('#f5f5f5')      # very light grey
    BG_ROW2 = colors.HexColor('#e0e0e0')      # light grey
    BG_REF = colors.HexColor('#fff8e1')       # pale yellow
    BORDER = colors.HexColor('#bdbdbd')       # soft grey

    title = Paragraph("<b>Einsätze Übersicht</b>", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))

    # Overview of filtered teams at the top
    if filtered_teams:
        overview_text = "<font color='#1976d2'><b>Für folgende Teams wurde die Übersicht erstellt:</b></font> " + ", ".join(filtered_teams)
        elements.append(Paragraph(overview_text, styles['Normal']))
        elements.append(Spacer(1, 12))

    # Table header
    data = [
        [
            Paragraph("<b>Zeit</b>", styles['Normal']),
            Paragraph("<b>Teams</b>", styles['Normal']),
            Paragraph("<b>Liga</b>", styles['Normal']),
            Paragraph("<b>Beteiligung</b>", styles['Normal'])
        ]
    ]
    schiedsrichter_rows = []
    for idx, einsatz in enumerate(einsaetze_list):
        involved = einsatz.get('involved', '')
        # Replace with colored text labels
        parts = []
        for part in involved.split(','):
            part = part.strip()
            if '(Spieler)' in part:
                label = part.replace('(Spieler)', '').strip()
                parts.append('<font color="#1976d2"><b>Spieler:</b> {}</font>'.format(label))
            elif '(SR)' in part:
                label = part.replace('(SR)', '').strip()
                parts.append('<font color="#ffa726"><b>SR:</b> {}</font>'.format(label))
        involved_label = ', '.join(parts) if parts else involved
        row = [
            Paragraph(einsatz.get('date', ''), styles['Normal']),
            Paragraph('<font color="#43a047"><b>{}</b></font>'.format(einsatz.get('teams', '')), styles['Normal']),
            Paragraph('<font color="#1976d2">{}</font>'.format(einsatz.get('liga', '')), styles['Normal']),
            Paragraph(involved_label, styles['Normal'])
        ]
        data.append(row)
        # Highlight Schiedsrichter rows
        if 'SR:' in involved_label:
            schiedsrichter_rows.append(idx + 1)  # +1 for header

    table = Table(data, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 14),
        ('GRID', (0, 0), (-1, -1), 1, BORDER),
    ]
    # Apply alternating backgrounds
    for i in range(1, len(data)):
        style.append(('BACKGROUND', (0, i), (-1, i), BG_ROW1 if (i-1)%2 == 0 else BG_ROW2))
    # Highlight Schiedsrichter rows
    for i in schiedsrichter_rows:
        style.append(('BACKGROUND', (0, i), (-1, i), BG_REF))
        style.append(('TEXTCOLOR', (0, i), (-1, i), WARNING))
    # Make Beteiligung column a bit wider
    style.append(('COLWIDTHS', (3, 0), (3, -1), 140))
    table.setStyle(TableStyle(style))
    elements.append(table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
