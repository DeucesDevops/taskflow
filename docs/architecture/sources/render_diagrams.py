#!/usr/bin/env python3
"""Rebuild the TaskFlow application architecture SVG/PNG pairs. Requires Pillow only.

Run from any directory: python3 docs/architecture/sources/render_diagrams.py
The SVG and PNG are drawn from the same coordinates and text. No network access.
"""
from pathlib import Path
from html import escape
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H, SCALE = 1800, 1250, 2
INK, MUTED, LINE = '#172e48', '#50647a', '#7290a7'
BLUE, GREEN, ORANGE, PURPLE = '#2865bc', '#168372', '#b76b13', '#7053a2'
PALETTE = {
    'blue': ('#edf4ff', BLUE), 'green': ('#eaf7f2', GREEN),
    'orange': ('#fff5e7', ORANGE), 'purple': ('#f3effa', PURPLE),
    'neutral': ('#ffffff', '#71849a'),
}
FONT_DIRS = [Path(os.environ.get('TASKFLOW_FONT_DIR', '/System/Library/Fonts/Supplemental')),
             Path('/usr/share/fonts/truetype/dejavu')]

def font_path(bold):
    for folder in FONT_DIRS:
        for name in (('Arial Bold.ttf', 'DejaVuSans-Bold.ttf') if bold else ('Arial.ttf', 'DejaVuSans.ttf')):
            if (folder / name).exists():
                return str(folder / name)
    raise RuntimeError('Install Arial or DejaVu Sans, or set TASKFLOW_FONT_DIR.')


class Diagram:
    def __init__(self, number, slug, title, subtitle, status):
        self.slug, self.number = slug, number
        self.im = Image.new('RGB', (W*SCALE, H*SCALE), '#f6f8fc')
        self.d = ImageDraw.Draw(self.im)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">',
                    f'<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}. {escape(status)}</desc>',
                    f'<rect width="{W}" height="{H}" fill="#f6f8fc"/>']
        self.rect(0, 0, W, 12, BLUE, BLUE, 0)
        self.text(60, 38, f'TASKFLOW  /  ARCHITECTURE {number:02}', 18, BLUE, True)
        self.text(60, 77, title, 46, INK, True)
        self.text(60, 143, subtitle, 21, MUTED)
        self.text(60, 187, status, 17, ORANGE, True)

    def rect(self, x, y, w, h, fill, stroke, radius=15, width=2):
        self.d.rounded_rectangle((x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE),radius=radius*SCALE,fill=fill,outline=stroke,width=width*SCALE)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')

    def text(self, x, y, value, size=19, color=INK, bold=False):
        f = ImageFont.truetype(font_path(bold), size*SCALE)
        width = self.d.textlength(value, font=f) / SCALE
        assert x >= 0 and x+width <= W-20, f'Text outside canvas: {value}'
        self.d.text((x*SCALE,y*SCALE), value, font=f, fill=color, anchor='lt')
        self.svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial,DejaVu Sans,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')
        return width

    def wrap(self, value, width, size=19, bold=False):
        font = ImageFont.truetype(font_path(bold), size*SCALE)
        out=[]
        for paragraph in value.split('\n'):
            line=''
            for word in paragraph.split():
                assert self.d.textlength(word, font=font)/SCALE <= width, f'Word too long: {word}'
                trial=(line+' '+word).strip()
                if self.d.textlength(trial,font=font)/SCALE > width:
                    out.append(line); line=word
                else:
                    line=trial
            out.append(line)
        return out

    def box(self, x, y, w, h, title, body='', tone='blue'):
        fill, accent=PALETTE[tone]
        self.rect(x,y,w,h,fill,accent)
        self.rect(x+15,y+18,5,h-36,accent,accent,2,1)
        for title_size,body_size in ((23,19),(22,18),(21,17),(20,16)):
            titles=self.wrap(title,w-64,title_size,True)
            bodies=self.wrap(body,w-64,body_size) if body else []
            title_step=title_size+6
            body_step=body_size+7
            needed=16+len(titles)*title_step+(5 if bodies else 0)+len(bodies)*body_step
            if needed <= h-8:
                break
        assert needed <= h-8, f'Box too small: {title}'
        yy=y+16
        for line in titles:
            self.text(x+34,yy,line,title_size,INK,True); yy+=title_step
        yy+=5 if bodies else 0
        if body:
            for line in bodies:
                self.text(x+34,yy,line,body_size,MUTED); yy+=body_step
        assert yy <= y+h-8, f'Box too small: {title}: {yy} > {y+h-8}'

    def group(self,x,y,w,h,title,tone='blue'):
        fill,accent=PALETTE[tone]
        self.rect(x,y,w,h,fill,'#cbd7e4',21)
        self.text(x+24,y+18,title,18,accent,True)

    def edge(self, points, color=LINE, dashed=False, arrow=True):
        segments=list(zip(points,points[1:]))
        for a,b in segments:
            if dashed:
                length=math.dist(a,b)
                for start in range(0,math.ceil(length),15):
                    t=start/length; u=min(start+8,length)/length
                    self.d.line([(int((a[0]+(b[0]-a[0])*t)*SCALE),int((a[1]+(b[1]-a[1])*t)*SCALE)),
                                 (int((a[0]+(b[0]-a[0])*u)*SCALE),int((a[1]+(b[1]-a[1])*u)*SCALE))],fill=color,width=3*SCALE)
            else:
                self.d.line([(int(a[0]*SCALE),int(a[1]*SCALE)),(int(b[0]*SCALE),int(b[1]*SCALE))],fill=color,width=3*SCALE)
        self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round"'+(' stroke-dasharray="8 7"' if dashed else '')+'/>')
        if arrow:
            a,b=points[-2:]; angle=math.atan2(b[1]-a[1],b[0]-a[0])
            tri=[b,(b[0]-13*math.cos(angle-.42),b[1]-13*math.sin(angle-.42)),(b[0]-13*math.cos(angle+.42),b[1]-13*math.sin(angle+.42))]
            self.d.polygon([(int(x*SCALE),int(y*SCALE)) for x,y in tri],fill=color)
            self.svg.append('<polygon points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in tri)+f'" fill="{color}"/>')

    def label(self,x,y,value,color=MUTED):
        f=ImageFont.truetype(font_path(False),17*SCALE)
        width=self.d.textlength(value,font=f)/SCALE
        self.rect(x-7,y-4,width+14,28,'#f6f8fc','#f6f8fc',5,1)
        self.text(x,y,value,17,color)

    def footer(self, first, second):
        self.edge([(60,1145),(1740,1145)],'#d5deea',arrow=False)
        self.text(60,1165,first,18,INK,True)
        self.text(60,1198,second,16,MUTED)
        self.svg.append('</svg>')
        (ROOT/f'{self.slug}.svg').write_text('\n'.join(self.svg)+'\n')
        self.im.save(ROOT/f'{self.slug}.png',optimize=True)


def docker():
    d=Diagram(1,'01-docker-architecture','Docker application architecture',
              'Eight containers: five application images and three persistent backing services.',
              'CURRENT SOURCE CONFIGURATION  |  Docker Compose; runtime not re-tested for this document')
    d.group(60,380,1680,515,'COMPOSE BACKEND NETWORK  /  internal: true')
    d.edge([(400,290),(500,290)],BLUE)
    for x in (285,695,1105,1515):
        d.edge([(825,350),(825,445),(x,445),(x,490)],BLUE)
    d.edge([(285,625),(285,680),(430,680),(430,730)],GREEN)
    d.edge([(695,625),(695,675),(550,675),(550,730)],GREEN)
    d.edge([(1105,625),(1105,655),(670,655),(670,730)],GREEN)
    d.edge([(285,625),(285,702),(900,702),(900,730)],PURPLE)
    d.edge([(1515,625),(1515,695),(1020,695),(1020,730)],PURPLE)
    d.box(60,240,340,110,'Browser','127.0.0.1:3000', 'neutral')
    d.box(500,240,650,110,'Frontend  :3000','Next.js UI + same-origin /api proxy')
    d.box(1230,240,510,110,'Host-only administration','PostgreSQL :5433; RabbitMQ UI :15672','neutral')
    apps=[('Auth  :3001','Node.js / TypeScript'),('Projects  :8080','Java / Spring Boot'),('Tasks  :8081','Go; transactional outbox'),('Notifications  :8000','Python / FastAPI')]
    for x,(title,body) in zip((100,510,920,1330),apps):
        d.box(x,490,370,135,title,body)
    d.box(275,730,450,130,'PostgreSQL  :5432','One instance; auth, projects and tasks schemas','green')
    d.box(815,730,420,130,'Redis  :6379','Revocable sessions; user feeds and event deduplication','purple')
    d.box(1315,730,380,130,'RabbitMQ  :5672','Durable taskflow.notifications queue','orange')
    # Explicit AMQP path is routed along the right of the task and notification cards.
    d.edge([(1290,590),(1305,590),(1305,795),(1315,795)],ORANGE)
    d.edge([(1515,730),(1515,625)],ORANGE)
    d.label(1070,866,'AMQP is private',ORANGE)
    for x in (500,1025,1505):
        d.edge([(x,860),(x,935)],GREEN)
    d.box(275,935,450,105,'postgres-data','Named Docker volume','green')
    d.box(815,935,420,105,'redis-data','Named volume; AOF enabled','purple')
    d.box(1315,935,380,105,'rabbitmq-data','Named Docker volume','orange')
    d.footer('Browser traffic enters through the frontend. Backend session and project-access checks use private HTTP.',
             'Solid arrows: requests, events or data. Sources: docker-compose.yml; frontend/src/lib/server-api.ts. Configuration stays outside images.')


def notifications():
    d=Diagram(4,'04-notification-delivery','Durable notification delivery',
              'Transactional outbox, RabbitMQ publisher confirmations and a Redis-backed activity feed.',
              'IMPLEMENTED PATH  |  At-least-once messaging; deduplication is bounded by a seven-day Redis TTL')
    d.group(60,240,1680,300,'WRITE PATH  /  browser -> Next.js API -> task-service')
    d.group(60,600,1680,320,'DELIVERY PATH  /  asynchronous consumer')
    d.group(60,980,1680,120,'READ PATH  /  browser activity panel')
    for a,b,y in ((450,520,380),(980,1050,380),(450,520,755),(1000,1070,755)):
        d.edge([(a,y),(b,y)],ORANGE if y==755 else BLUE)
    d.edge([(1370,485),(1370,570),(255,570),(255,675)],ORANGE)
    d.label(635,549,'persistent message + publisher confirmation',ORANGE)
    d.edge([(1260,485),(1260,550),(750,550),(750,485)],GREEN,True)
    d.label(770,518,'confirm -> mark delivered',GREEN)
    d.edge([(1550,485),(1550,585),(1600,585),(1600,485)],ORANGE,True)
    d.label(1350,552,'retry on failure',ORANGE)
    d.box(105,310,345,175,'1. Task mutation','Validate session and project membership before writing')
    d.box(520,310,460,175,'2. One SQL transaction','Task change + outbox event commit together in PostgreSQL','green')
    d.box(1050,310,630,175,'3. Outbox worker','Claim a lease; publish stable event ID; confirm delivery; retry with backoff after failure','orange')
    d.box(105,675,345,165,'4. RabbitMQ','Durable queue\ntaskflow.notifications','orange')
    d.box(520,675,480,165,'5. Notification consumer','Validate event; atomically ingest into Redis; ACK only after success','blue')
    d.box(1070,675,610,165,'6. Redis Lua operation','Deduplicate event ID + prepend user feed; keep latest 100; feed and dedup TTL: 7 days','purple')
    d.text(105,867,'Storage failure: NACK + requeue. Invalid event: reject without requeue.',19,MUTED)
    d.text(105,1026,'GET /api/notifications  ->  Next.js proxy  ->  notification API  ->  auth validation + Redis feed  ->  JSON UI',22,INK,True)
    d.footer('A crash after publish can cause a replay. Redis suppresses duplicates while its dedup key exists.',
             'Redis loss or TTL expiry can remove that protection. No email, SMS, WebSocket or SQS delivery is implemented in this path.')


if __name__ == '__main__':
    for build in (docker, notifications):
        build()
    print('Rendered application diagrams: 3600 x 2500 PNG plus editable SVG.')
