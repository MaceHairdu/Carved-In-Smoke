from bs4 import BeautifulSoup
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xml.sax.saxutils import escape
import re

source = BeautifulSoup(open('handbook.html', encoding='utf-8').read(), 'html.parser')
pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BookTitle', fontName='DejaVuBold', fontSize=24, leading=30, spaceAfter=22, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='ChapterTitle', fontName='DejaVuBold', fontSize=17, leading=23, spaceBefore=20, spaceAfter=12, keepWithNext=True))
styles.add(ParagraphStyle(name='SectionTitle', fontName='DejaVuBold', fontSize=12, leading=17, spaceBefore=14, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name='BookBody', fontName='DejaVu', fontSize=9.5, leading=15, spaceAfter=8))
styles.add(ParagraphStyle(name='BookList', parent=styles['BookBody'], leftIndent=14, firstLineIndent=-8))
styles.add(ParagraphStyle(name='BookTable', fontName='DejaVu', fontSize=7.5, leading=11))
story = [Paragraph('CARVED IN SMOKE', styles['BookTitle']), Paragraph('Player Handbook', styles['BookTitle']), Spacer(1, 24)]
def rich(node):
    if isinstance(node, str):
        return escape(node)
    if node.name == 'br': return '<br/>'
    body = ''.join(rich(child) for child in node.children)
    if node.name in ('strong','b'): return '<b>'+body+'</b>'
    if node.name in ('em','i'): return '<i>'+body+'</i>'
    return body
def para(node, style='BookBody'):
    text = rich(node).strip()
    if text: story.append(Paragraph(text, styles[style]))
for chapter in source.select('article.chapter'):
    heading = chapter.find('h1')
    if not heading: continue
    story.append(Paragraph(escape(heading.get_text(' ',strip=True)), styles['ChapterTitle']))
    body = chapter.select_one('.chapter-body')
    if not body: continue
    for element in body.children:
        if not getattr(element,'name',None): continue
        tag=element.name
        if tag in ('h2','h3','h4'):
            para(element,'SectionTitle')
        elif tag=='p':
            para(element)
        elif tag in ('ul','ol'):
            for li in element.find_all('li',recursive=False):
                text=rich(li).strip()
                if text: story.append(Paragraph(('• ' if tag=='ul' else '– ')+text, styles['BookList']))
        elif tag=='table' or element.find('table'):
            table=element if tag=='table' else element.find('table')
            rows=[]
            for tr in table.find_all('tr'):
                cells=tr.find_all(['td','th'],recursive=False)
                if not cells: continue
                rows.append([Paragraph(rich(cell),styles['BookTable']) for cell in cells])
            if rows:
                widths=[(letter[0]-92)/max(len(row) for row in rows)]*max(len(row) for row in rows)
                t=Table(rows,colWidths=widths,repeatRows=1 if table.find('th') else 0,hAlign='LEFT')
                t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#c7b89b'))]))
                story.append(t)
def footer(canvas,doc):
    canvas.saveState()
    canvas.setFont('DejaVu',8)
    canvas.drawCentredString(letter[0]/2,29,f'Carved in Smoke — {doc.page}')
    canvas.restoreState()
SimpleDocTemplate('Carved-in-Smoke-Handbook.pdf',pagesize=letter,rightMargin=46,leftMargin=46,topMargin=48,bottomMargin=48,title='Carved in Smoke — Player Handbook').build(story,onFirstPage=footer,onLaterPages=footer)
print('PDF generated')
