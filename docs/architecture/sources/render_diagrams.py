#!/usr/bin/env python3
"""Rebuild the six TaskFlow architecture SVG/PNG pairs. Requires Pillow only.

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


def aws():
    d=Diagram(2,'02-aws-kops-architecture','AWS architecture with kOps',
              'A proposed AWS foundation around the application\'s current Kubernetes routing and storage model.',
              'PROPOSED TARGET  |  No kOps spec or Terraform infrastructure was found in the application checkout')
    d.group(60,370,1200,720,'AWS VPC  /  proposed public and private subnet tiers across three Availability Zones')
    d.group(90,430,1140,160,'PUBLIC SUBNETS  /  load balancer and outbound egress','orange')
    d.group(90,620,1140,435,'PRIVATE SUBNETS  /  EC2 Kubernetes nodes managed by kOps')
    d.edge([(405,290),(500,290)],BLUE)
    d.edge([(795,345),(795,360),(75,360),(75,520),(135,520)],BLUE)
    d.edge([(135,545),(105,545),(105,730),(135,730)],BLUE)
    d.edge([(425,785),(425,835)],BLUE)
    d.edge([(700,890),(800,890)],GREEN)
    d.edge([(1020,945),(1020,980)],GREEN)
    d.edge([(1310,727),(1230,727),(1230,720),(1185,720)],PURPLE,True)
    d.edge([(1185,890),(1240,890),(1240,925),(1310,925)],GREEN,True)
    d.edge([(700,875),(750,875),(750,660),(1205,660),(1205,600),(890,600),(890,565)],ORANGE,True)
    d.label(905,597,'outbound pulls',ORANGE)
    d.edge([(1040,475),(1040,410),(1485,410),(1485,345)],ORANGE,True)
    d.edge([(1310,510),(1250,510),(1250,750),(1185,750)],PURPLE,True)
    d.edge([(800,730),(755,730),(755,810),(425,810),(425,835)],PURPLE,True)
    d.box(60,240,345,105,'Users','HTTPS :443','neutral')
    d.box(500,240,590,105,'Application DNS','taskflow.deuces.dev -> ALB; DNS provider to be configured','neutral')
    d.box(1310,240,430,105,'Image registry','ECR proposed; current tags use Docker Hub','orange')
    d.box(135,475,580,90,'AWS ALB + ACM','TLS ends here; HTTP to NGINX','orange')
    d.box(800,475,385,90,'NAT egress + IGW','Registry and required APIs','orange')
    d.box(135,675,580,110,'NodePort -> F5 NGINX','Routes / to frontend; backends stay private')
    d.box(800,675,385,110,'Control plane + etcd','3 EC2 nodes for HA target','purple')
    d.box(135,835,565,110,'Application worker pods','Frontend -> Auth / Projects / Tasks / Notifications')
    d.box(800,835,385,110,'In-cluster data pods','PostgreSQL / Redis / RabbitMQ','green')
    d.box(800,980,385,60,'Encrypted gp3 EBS','', 'green')
    d.box(1310,455,430,145,'Cluster lifecycle','kOps CLI; restricted API endpoint; cluster DNS configured separately','purple')
    d.box(1310,650,430,155,'Platform prerequisites','Load Balancer Controller; EBS CSI; workload IAM; CNI and CoreDNS','purple')
    d.box(1310,860,430,160,'Private S3 stores','Separate Terraform state, kOps state and backup locations; versioning + encryption','green')
    d.footer('AWS layout is proposed. Current data Deployments remain single-replica; three AZs do not make their data highly available.',
             'Solid: application/data path. Dashed: lifecycle, provisioning or egress. RDS, ElastiCache and SQS are outside this first kOps target.')


def kubernetes():
    d=Diagram(3,'03-kubernetes-cluster','Kubernetes cluster architecture',
              'Plain YAML: eight single-replica Deployments, eight ClusterIP Services and three persistent claims.',
              'CURRENT MANIFESTS  |  Static configuration reviewed; cluster deployment remains unverified')
    d.group(60,430,1190,655,'NAMESPACE  /  taskflow')
    d.group(1290,240,450,340,'PLATFORM  /  installation prerequisites','purple')
    d.edge([(355,300),(465,300)],BLUE)
    d.edge([(1025,300),(1175,300),(1175,500),(890,500),(890,535)],BLUE)
    for x in (240,525,810,1095):
        d.edge([(650,615),(650,650),(x,650),(x,695)],BLUE)
    d.edge([(240,815),(240,845),(260,845),(260,895)],GREEN)
    d.edge([(525,815),(525,855),(380,855),(380,895)],GREEN)
    d.edge([(810,815),(810,875),(445,875),(445,895)],GREEN)
    d.edge([(240,815),(240,865),(580,865),(580,895)],PURPLE)
    d.edge([(1095,815),(1095,845),(740,845),(740,895)],PURPLE)
    d.edge([(810,815),(810,880),(1000,880),(1000,895)],ORANGE)
    d.edge([(1200,970),(1235,970),(1235,835),(1125,835),(1125,815)],ORANGE)
    d.edge([(1740,410),(1765,410),(1765,925),(1740,925)],PURPLE,True)
    d.box(60,245,295,110,'AWS ALB','Instance targets; ACM','orange')
    d.box(465,245,560,110,'NGINX NodePort + controller','namespace: nginx-ingress; ingress class: nginx')
    d.box(1315,300,400,115,'AWS controllers + IAM','Load Balancer Controller; EBS CSI','purple')
    d.box(1315,440,400,110,'Cluster networking','CNI, CoreDNS; restricted API','purple')
    d.box(430,535,460,80,'Frontend Service + pod','Next.js :3000')
    for x,title,body in ((110,'Auth','Service :3001 -> pod'),(395,'Projects','Service :8080 -> pod'),(680,'Tasks','Service :8081 -> pod'),(965,'Notifications','Service :8000 -> pod')):
        d.box(x,695,260,120,title,body)
    d.box(135,895,335,150,'PostgreSQL','Service :5432 -> pod\npostgres-data: 3Gi RWO','green')
    d.box(500,895,335,150,'Redis','Service :6379 -> pod\nredis-data: 3Gi RWO','purple')
    d.box(865,895,335,150,'RabbitMQ','Service :5672 -> pod\nrabbitmq-data: 3Gi RWO','orange')
    d.box(1290,645,450,155,'Runtime configuration','taskflow-config: APP_ORIGIN\ntaskflow-secrets: credentials\nInjected through environment','neutral')
    d.box(1290,850,450,220,'Storage and update policy','taskflow-gp3: encrypted; Retain; WaitForFirstConsumer. All eight Deployments: 1 replica + Recreate. Data pods have no replication.','green')
    d.footer('Green: PostgreSQL writes. Purple: Redis access. Orange: RabbitMQ events. Cross-service HTTP checks appear in diagram 01 notes.',
             'All app pods define /health and /ready probes. Current files: kubernetes/*-deployment.yaml, *-service.yaml, *-pvc.yaml.')


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


def pipeline():
    d=Diagram(5,'05-delivery-pipeline','CI and application delivery',
              'Keep validated artifacts traceable from source commit to the eventual Kubernetes deployment.',
              'MIXED STATUS  |  Upper flow exists in CI; the lower delivery flow is proposed')
    d.group(60,240,1680,585,'CURRENT GITHUB ACTIONS  /  pull request, main or milestone branch, version tag, manual dispatch')
    d.edge([(375,355),(460,355)],BLUE)
    d.edge([(925,355),(1010,355)],BLUE)
    d.edge([(1620,425),(1620,485),(355,485),(355,550)],GREEN)
    d.edge([(600,635),(700,635)],GREEN)
    d.edge([(1190,635),(1290,635)],GREEN)
    d.box(105,300,270,125,'Source commit','Read-only CI permissions','neutral')
    d.box(460,300,465,125,'Required source gates','Workflow lint; 5 language checks; Semgrep; Trivy repository scan')
    d.box(1010,300,670,125,'Five production image builds','Frontend / Auth / Projects / Tasks / Notifications')
    d.box(105,550,495,175,'Image evidence + policy','Syft SPDX SBOM; Trivy SARIF; block HIGH/CRITICAL; export scanned images','green')
    d.box(700,550,490,175,'Full-stack integration','Load exact archives; no rebuild; smoke, isolation, Redis, hardening and restart checks','green')
    d.box(1290,550,390,175,'Retained results','Security reports + temporary image archives; SonarQube optional','green')
    d.group(60,875,1680,225,'PROPOSED CD  /  implement after cluster and registry prerequisites','orange')
    for a,b in ((405,455),(850,900),(1260,1310)):
        d.edge([(a,1000),(b,1000)],ORANGE,True)
    d.box(105,935,300,125,'GitHub OIDC','Scoped AWS publisher role','orange')
    d.box(455,935,395,125,'ECR image promotion','Commit SHA + digest; preserve tested artifact','orange')
    d.box(900,935,360,125,'Deploy to Kubernetes','Private API access; scoped RBAC','orange')
    d.box(1310,935,370,125,'Verify + promote','Rollout and smoke; production approval; rollback','orange')
    d.footer('Current CI publishes GitHub workflow artifacts only. It does not push a registry image or deploy infrastructure.',
             'Solid: implemented job flow. Dashed: proposed delivery. Sources: .github/workflows/ci.yml; docs/continuous-integration.md.')


def operations():
    d=Diagram(6,'06-platform-operations','Platform operations and recovery',
              'Separate resource ownership, credentials, application data and cluster recovery.',
              'PROPOSED OPERATING MODEL  |  Current local controls and remaining AWS work are recorded in the plan')
    d.group(60,240,530,850,'PROVISION + MAINTAIN','blue')
    d.group(635,240,530,850,'CONFIGURE + OBSERVE','purple')
    d.group(1210,240,530,850,'BACK UP + RECOVER','green')
    d.edge([(325,455),(325,515)],BLUE,True)
    d.edge([(325,705),(325,765)],BLUE,True)
    d.edge([(900,455),(900,515)],PURPLE,True)
    d.edge([(900,705),(900,765)],PURPLE,True)
    d.edge([(1475,455),(1475,515)],GREEN,True)
    d.edge([(1475,705),(1475,765)],GREEN,True)
    d.box(90,310,470,145,'Terraform foundation','VPC, subnet routes, NAT, ECR, state storage, IAM integrations; proposed')
    d.box(90,515,470,190,'kOps cluster lifecycle','EC2 control plane and workers; etcd; cluster IAM and API endpoint. Review changes and validate after rolling updates.','blue')
    d.box(90,765,470,230,'Workloads and addons','Plain application YAML today. Optional application Helm chart later. Give every addon one owner: kOps or Helm.','blue')
    d.box(665,310,470,145,'Managed runtime secrets','Proposed Secrets Manager -> External Secrets Operator -> Kubernetes Secret','purple')
    d.box(665,515,470,190,'Application configuration','ConfigMap + Secret -> environment. Restart workloads after changes; rotate actual database and broker credentials too.','purple')
    d.box(665,765,470,230,'Metrics, logs and alerts','Proposed: application errors, readiness, outbox age, queue depth, Redis memory, nodes, etcd and backup failures.','purple')
    d.box(1240,310,470,145,'Different recovery assets','Terraform state; kOps state; etcd backup; SQL backup; Redis and RabbitMQ recovery data','green')
    d.box(1240,515,470,190,'Protected backup locations','Encrypted, access-restricted stores; retention and recovery objectives; independent of worker disks and PVC lifetimes','green')
    d.box(1240,765,470,230,'Prove restoration','Restore in isolation; validate task records and notification behavior; record RPO/RTO. Retain storage is not a backup.','green')
    d.footer('Current: ignored local .env; Kubernetes Secret template; persistent volumes; health probes; CI hardening checks.',
             'Target: managed secrets, workload IAM, observability and tested restores. Cluster backups do not contain PostgreSQL volume data.')


if __name__ == '__main__':
    for build in (docker,aws,kubernetes,notifications,pipeline,operations):
        build()
    print('Rendered six diagrams: 3600 x 2500 PNG plus editable SVG.')
