"""Editable orthographic reconstruction of the Pipe Panic reference. Blender 5.2."""
from pathlib import Path
import os
from math import sin, cos, pi
import random
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
W, H, PX = 1051, 1496, 130.0
random.seed(832)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Pipe Panic | Orthographic pump console"
scene.render.engine = 'CYCLES'
scene.cycles.samples = 88
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 10
scene.cycles.glossy_bounces = 5
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -.33
scene.world = bpy.data.worlds.new('Dark blue studio')
scene.world.use_nodes = True
world = next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
world.inputs['Color'].default_value = (.22,.29,.39,1)
world.inputs['Strength'].default_value = .20

def xyz(x,y,z=0):
    return Vector(((x-W/2)/PX,(H/2-y)/PX,z))
def rgb(h):
    t=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<.04045 else ((x+.055)/1.055)**2.4 for x in t)
def group(name):
    c=bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c
base=group('01 · Console and plumbing')
board=group('02 · 7 x 6 board and obstacles')
lines=group('03 · Brass network, glass and water')
bits=group('04 · Valves and indicator lamps')
tray=group('05 · Queue and advance button')
studio=group('06 · Camera and lights')

def pbr(name,h,rough=.4,metal=.0,coat=.13,em=None,strength=0,ior=1.46,trans=0,spec=.40):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    m.diffuse_color=(*rgb(h),1)
    s=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for key,value in {'Base Color':(*rgb(h),1),'Roughness':rough,'Metallic':metal,'Coat Weight':coat,
                      'Specular IOR Level':spec,'Coat Roughness':max(.21,rough*.8),
                      'IOR':ior,'Transmission Weight':trans}.items():
        s.inputs[key].default_value=value
    if em:
        s.inputs['Emission Color'].default_value=(*rgb(em),1)
        s.inputs['Emission Strength'].default_value=strength
    return m

def mottled(mat,colors,coarse=11,fine=145,bump=.18,roughness=(.35,.59),strength=.20):
    tree=mat.node_tree
    nodes,link=tree.nodes,tree.links
    p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    tex=nodes.new('ShaderNodeTexCoord')
    low=nodes.new('ShaderNodeTexNoise')
    low.inputs['Scale'].default_value=coarse
    low.inputs['Detail'].default_value=4
    low.inputs['Roughness'].default_value=.78
    high=nodes.new('ShaderNodeTexNoise')
    high.inputs['Scale'].default_value=fine
    high.inputs['Detail'].default_value=2
    link.new(tex.outputs['Object'],low.inputs['Vector'])
    link.new(tex.outputs['Object'],high.inputs['Vector'])
    mix=nodes.new('ShaderNodeMixRGB')
    mix.blend_type='OVERLAY'
    mix.inputs[0].default_value=strength
    link.new(low.outputs['Fac'],mix.inputs[1])
    link.new(high.outputs['Fac'],mix.inputs[2])
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.22
    ramp.color_ramp.elements[1].position=.79
    ramp.color_ramp.elements[0].color=(*rgb(colors[0]),1)
    ramp.color_ramp.elements[1].color=(*rgb(colors[2]),1)
    ramp.color_ramp.elements.new(.51).color=(*rgb(colors[1]),1)
    link.new(mix.outputs['Color'],ramp.inputs['Fac'])
    link.new(ramp.outputs['Color'],p.inputs['Base Color'])
    rough=nodes.new('ShaderNodeMapRange')
    rough.inputs['To Min'].default_value=roughness[0]
    rough.inputs['To Max'].default_value=roughness[1]
    link.new(high.outputs['Fac'],rough.inputs['Value'])
    link.new(rough.outputs[0],p.inputs['Roughness'])
    relief=nodes.new('ShaderNodeBump')
    relief.inputs['Distance'].default_value=.019
    relief.inputs['Strength'].default_value=bump
    link.new(high.outputs['Fac'],relief.inputs['Height'])
    link.new(relief.outputs['Normal'],p.inputs['Normal'])
    return mat

back=mottled(pbr('Console · hammered midnight steel','112330',.61,.32,coat=0,spec=.21),('091520','142634','223340'),5,175,.15,(.56,.72),.53)
border=mottled(pbr('Board frame · chipped blue steel','253C4C',.51,.42,coat=.04,spec=.26),('172633','324653','636C6B'),9,135,.18,(.42,.63),.47)
edge=mottled(pbr('Edge bevel · burnished steel','62717A',.42,.68,coat=.05,spec=.30),('273744','51616B','86857D'),13,166,.13,(.33,.53),.38)
inset=mottled(pbr('Recess · black iron','111B23',.61,.24,coat=0,spec=.19),('0C1319','171F24','293237'),14,175,.12,(.55,.73),.43)
tiles=[]
for i,(a,b,c) in enumerate([('1C303D','344C5C','4D6777'),('1D3240','364F60','536F7D'),
                           ('1B2D3A','324A59','4D6676'),('203540','38505F','52707E')]):
    tiles.append(mottled(pbr('Slate tile %02d'%i,b,.63,.12,coat=0,spec=.22),(a,b,c),14+i*2,181,.16,(.55,.72),.60))
brass=mottled(pbr('Brass · satin weathered','A77B43',.34,.64,coat=.15),('6B5437','BA9970','DCBC91'),18,160,.13,(.25,.48),.47)
bright=mottled(pbr('Brass · polished turned edge','D0A56A',.27,.80,coat=.27),('9D7143','C39A5F','E8C291'),17,180,.09,(.18,.36),.36)
darkbrass=mottled(pbr('Brass · patinated','715333',.43,.63),('3C2A1A','715334','A27E52'),14,152,.16,(.37,.56),.37)
rubber=pbr('Gasket · black rubber','152127',.66,.06,coat=0)
cap=mottled(pbr('Hazard plate · steel','3E3D3A',.52,.52),('202629','474843','5A5F58'),17,146,.19,(.41,.66),.53)
stripe=mottled(pbr('Hazard stripe · faded ochre','AD8650',.53,.28),('5F5136','967340','BB9557'),20,154,.19,(.41,.61),.61)
red=mottled(pbr('Outlet · vermilion enamel','B53017',.34,.44,coat=.39),('671B12','A82D1C','CA492A'),15,200,.11,(.27,.42),.31)
green=mottled(pbr('Inlet · green enamel','168249',.34,.43,coat=.38),('064C31','177243','329C5E'),15,200,.11,(.27,.42),.31)
red_lens=pbr('Red status lens','F64511',.23,.14,coat=.24,em='FF2203',strength=1.45)
red_core=pbr('Lamp hotspot','FFBB4B',.23,.10,coat=.18,em='FF6911',strength=2.9)
green_lens=pbr('Green status lens','2BDD5E',.22,.17,coat=.27,em='0EFF42',strength=1.50)
green_core=pbr('Green hotspot','92FF9B',.22,.10,coat=.19,em='5FFF65',strength=2.35)
amber=pbr('Selected socket · amber rim','FFAE43',.30,.20,em='FF7005',strength=2.2)
aqua=pbr('Advance key · blue green enamel','03535E',.29,.21,coat=.07,em='00616C',strength=.24,spec=.15)
aqua_line=pbr('Advance key · luminous rim','32BBC7',.24,.29,em='2ACBDA',strength=.90)
aqua_arrow=pbr('Advance key · translucent arrow','42F4E2',.25,.16,em='09F4DA',strength=1.1)
glass=pbr('Sight glass · clear shell','DEFAFF',.115,0,coat=0,ior=1.46,trans=1.0,spec=.23)
water=pbr('Liquid · deep cyan','12617D',.27,.02,coat=0,ior=1.333,trans=.19,em='0096CF',strength=.31,spec=.10)
water_spec=pbr('Liquid · line glint','7ED7ED',.19,.08,em='4BC9F2',strength=.37)
bubble=pbr('Air bubbles · bright blue rims','83DAF3',.15,.12,coat=.25,em='51C3F0',strength=.40)
bubble_dull=pbr('Air bubbles · soft rim','309ABF',.25,.05,coat=.14,em='29A0E0',strength=.27)

def mesh(name,vertices,faces,coll,mats):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    coll.objects.link(obj)
    for m in mats: data.materials.append(m)
    return obj

def outline(cx,cy,w,h,r,n=9):
    corners=[(cx+w/2-r,cy+h/2-r),(cx-w/2+r,cy+h/2-r),
             (cx-w/2+r,cy-h/2+r),(cx+w/2-r,cy-h/2+r)]
    return [(x+r*cos((corner+j/n)*pi/2),y+r*sin((corner+j/n)*pi/2))
            for corner,(x,y) in enumerate(corners) for j in range(n+1)]

def plate(name,box,z,thick,r,mat,coll,bevel=.025):
    x0,y0,x1,y1=box
    c=xyz((x0+x1)/2,(y0+y1)/2)
    w,h=(x1-x0)/PX,(y1-y0)/PX
    r=r/PX
    step=min(bevel,thick/2,r*.8)
    rings=[(z-thick,step),(z-thick+step,0),(z-step,0),(z-step*.28,step*.27),(z,step)]
    vs=[(x,y,lvl) for lvl,d in rings for x,y in outline(c.x,c.y,w-2*d,h-2*d,r-d)]
    n=len(vs)//len(rings)
    faces=[tuple(reversed(range(n)))]
    for i in range(len(rings)-1):
        faces.extend((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for j in range(n))
    faces.append(tuple(range((len(rings)-1)*n,len(rings)*n)))
    obj=mesh(name,vs,faces,coll,[mat])
    for p in obj.data.polygons:
        if len(p.vertices)==4: p.use_smooth=True
    mod=obj.modifiers.new('Weighted bevel normals','WEIGHTED_NORMAL')
    mod.keep_sharp=True
    return obj

def bevel(obj,amount):
    m=obj.modifiers.new('Machined edges','BEVEL')
    m.width=amount
    m.segments=3
    obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')

def cyl(name,p,axis,r,depth,mat,coll,segments=36,edge_size=.013):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=depth,location=p)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)
    obj.data.materials.append(mat)
    if edge_size: bevel(obj,edge_size)
    for poly in obj.data.polygons: poly.use_smooth=len(poly.vertices)==4
    return obj

def ring_panel(name,outer,inset_px,z,r,mat,coll):
    x0,y0,x1,y1=outer
    c=xyz((x0+x1)/2,(y0+y1)/2)
    w,h=(x1-x0)/PX,(y1-y0)/PX
    d=inset_px/PX
    r=r/PX
    boundary=outline(c.x,c.y,w,h,r)
    inside=outline(c.x,c.y,w-2*d,h-2*d,max(.018,r-d))
    n=len(boundary)
    vs=[(x,y,z) for x,y in boundary]+[(x,y,z) for x,y in inside]
    f=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,f,coll,[mat])

UP=Vector((0,0,1))
X=Vector((1,0,0))
Y=Vector((0,1,0))
def screw(x,y,z,size=.074,coll=base,rot=.74):
    p=xyz(x,y,z)
    cyl('Recessed washer',p,UP,size*1.10,.026,rubber,coll,24,.008)
    head=cyl('Slotted fastener',p+UP*.020,UP,size,.034,edge,coll,24,.010)
    for k,w in [(0,1.19),(1,.75)]:
        a=rot+k*pi/2
        d=Vector((cos(a),sin(a),0))
        cyl('Recessed screw slot',p+UP*.039,d,size*.090,size*w,inset,coll,10,.003)
    return head

def line_box(name,a,b,width,z,mat,coll):
    pa,pb=xyz(*a,z),xyz(*b,z)
    delta=pb-pa
    return cyl(name,(pa+pb)/2,delta,width/2/PX,delta.length,mat,coll,16,.005)

plate('Pump-station console',(0,0,W,H),-.046,.25,18,back,base)
plate('Top recessed display',(95,-125,959,115),.012,.078,34,border,base)
plate('Top dark inset',(102,-130,952,111),.018,.034,29,inset,base)
ring_panel('Display perimeter',(103,-129,952,112),1.8,.022,28,edge,base)

def lateral(path):
    out=[]
    for i,p in enumerate(path):
        a=path[max(0,i-1)]
        b=path[min(i+1,len(path)-1)]
        tangent=(b-a).normalized()
        out.append(Vector((-tangent.y,tangent.x,0)))
    return out

def sleeve(name,path,r,mat,coll,inner=0,segments=32):
    if len(path)==2:
        # Middle rings keep cylinder normals stable away from the end faces.
        a,b=path
        path=[a.lerp(b,t) for t in (0,.025,.16,.5,.84,.975,1)]
    side=lateral(path)
    vs=[]
    radii=[r,inner] if inner else [r]
    for radius in radii:
        for i,p in enumerate(path):
            for j in range(segments):
                a=2*pi*j/segments
                vs.append(p+radius*(cos(a)*side[i]+sin(a)*UP))
    stride=len(path)*segments
    faces=[]
    for k,radius in enumerate(radii):
        for i in range(len(path)-1):
            for j in range(segments):
                a=k*stride+i*segments+j
                b=k*stride+i*segments+(j+1)%segments
                face=(a,b,b+segments,a+segments)
                faces.append(face if k==0 else tuple(reversed(face)))
    smooth_faces=len(faces)
    if inner:
        end=stride-segments
        for j in range(segments):
            k=(j+1)%segments
            faces.append((j,stride+j,stride+k,k))
            faces.append((end+j,end+k,stride+end+k,stride+end+j))
    else:
        faces+=[tuple(reversed(range(segments))),tuple(range(stride-segments,stride))]
    obj=mesh(name,vs,faces,coll,[mat])
    for p in obj.data.polygons: p.use_smooth=p.index<smooth_faces
    return obj

def elbow(center,one,two,r,reach):
    q=center+(one+two)*r
    p=[center+one*reach,center+one*r]
    for i in range(1,17):
        a=pi*i/32
        p.append(q-two*r*cos(a)-one*r*sin(a))
    return p+[center+two*reach]

def edge_pipe(right=False):
    x=1031 if right else 19
    sign=-1 if right else 1
    path=[xyz(x,-38,.037),xyz(x,1304,.036)]
    for j in range(1,13):
        t=j/12
        path.append(xyz(x+sign*124*t*t,1304+219*t,.037))
    sleeve('External return pipe',path,.245,border,base,segments=38)
    for yp in [115,390,412,1122,1152,1322,1377]:
        t=max(0,(yp-1304)/219)
        p=xyz(x+sign*124*t*t,yp,.036)
        axis=Vector((-sign*248*t/219,1,0)).normalized()
        cyl('External support band',p,axis,.268,.065,darkbrass,base,32,.013)
        cyl('External support band rim',p+axis*.033,axis,.276,.029,brass,base,32,.007)
    for yp in (80,1360):
        t=max(0,(yp-1304)/219)
        p=xyz(x+sign*124*t*t,yp,.036)
        axis=Vector((-sign*248*t/219,1,0)).normalized()
        cyl('Main conduit union',p,axis,.313,.18,darkbrass,base,28,.021)
        cyl('Worn union flange',p+axis*.077,axis,.317,.038,bright,base,28,.012)
    for xp,yp in [(x,117),(x,1323)]:
        screw(xp+(25 if not right else -25),yp,.105,.061)

edge_pipe()
edge_pipe(True)
for x in (93,956):
    sleeve('Top feed line',[xyz(x,-10,.026),xyz(x,132,.026)],.151,border,base)
    cyl('Top feed coupler',xyz(x,36,.026),Y,.170,.14,brass,base,24,.015)
    screw(x,119,.155,.056)

plate('Grid chassis main body',(39,209,1012,1070),.125,.26,29,border,board,.047)
ring_panel('Chassis outer bevel trace',(42,211,1009,1067),2.0,.125,28,edge,board)
plate('Grid recessed lip',(65,238,988,1040),.145,.073,15,inset,board)
ring_panel('Board interior metal lip',(68,242,984,1037),2.5,.147,14,edge,board)
plate('Black grid bed',(72,246,980,1033),.148,.041,11,rubber,board)
for x in (62,987):
    for y in (229,1047):
        screw(x,y,.139,.084,board,rot=.60 if x==62 else 1.02)

for row in range(6):
    for col in range(7):
        x,y=74+129.25*col,248+130.25*row
        plate('Tile %d,%d'%(col+1,row+1),(x,y,x+126.4,y+126.7),.192,.069,7.0,
              tiles[(row*9+col*17)%4],board,.031)

def hazard(x,y):
    plate('Locked maintenance plate',(x-60,y-61,x+60,y+61),.258,.091,9,cap,board)
    ring_panel('Maintenance plate metal lip',(x-59,y-60,x+59,y+60),1.6,.259,9,edge,board)
    for dx in (-25,0,25):
        points=[xyz(x+dx-20,y+18,.261),xyz(x+dx-8,y+18,.261),
                xyz(x+dx+20,y-20,.261),xyz(x+dx+8,y-20,.261)]
        mesh('Worn safety stripe',points,[(0,1,2,3)],board,[stripe])
    for dx in (-47,47):
        for dy in (-48,48):
            screw(x+dx,y+dy,.267,.041,board,.62 if dy>0 else 1.1)
hazard(786,442)
hazard(786,834)

ZPIPE=.457
def P(x,y):
    return xyz(x,y,ZPIPE)

def coupling(p,axis,r=.267,length=.260,coll=lines):
    a=Vector(axis).normalized()
    cyl('Union nut housing',p,a,r,length*.68,brass,coll,segments=12,edge_size=.017)
    cyl('Turned inset collar',p,a,r*.913,length*.99,darkbrass,coll,segments=36,edge_size=.014)
    for side in (-1,1):
        cyl('Polished shoulder',p+side*a*(length*.44),a,r*.989,length*.16,bright,coll,32,.011)
        cyl('Compression seal',p+side*a*(length*.58),a,r*.796,length*.11,rubber,coll,28,.008)
        cyl('Brass inner sleeve',p+side*a*(length*.65),a,r*.825,length*.12,brass,coll,32,.006)

def loop_glint(name,center,r,mat,coll,segments=14):
    vs=[]
    for radius in (r*.72,r):
        vs.extend(center+Vector((radius*cos(2*pi*i/segments),radius*sin(2*pi*i/segments),0)) for i in range(segments))
    return mesh(name,vs,[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)],coll,[mat])

def water_section(name,path):
    side=lateral(path)
    # Partly filled sight tubes have a flat water surface rather than a second glass-like lens.
    profile=[(cos(pi+pi*i/20)*.158,sin(pi+pi*i/20)*.158) for i in range(21)]
    count=len(profile)
    verts=[p+s*x+UP*z for p,s in zip(path,side) for x,z in profile]
    faces=[tuple(reversed(range(count)))]
    for i in range(len(path)-1):
        faces.extend((i*count+j,i*count+(j+1)%count,(i+1)*count+(j+1)%count,(i+1)*count+j)
                     for j in range(count))
    faces.append(tuple(range((len(path)-1)*count,len(path)*count)))
    liquid=mesh(name+' · partial liquid fill',verts,faces,lines,[water])
    for face in liquid.data.polygons:
        face.use_smooth=len(face.vertices)==4 and face.index%count!=0
    sleeve(name+' · thick glass',path,.200,glass,lines,inner=.164,segments=36)
    # Parallel clean reflections are on the liquid side of the glass.
    for dx,dz,r in [(-.104,.153,.004),(.093,.168,.003)]:
        sheen=[p+dx*s+UP*dz for p,s in zip(path,side)]
        sleeve('Liquid edge glint',sheen,r,water_spec,lines,segments=9)
    total=sum((b-a).length for a,b in zip(path,path[1:]))
    for i in range(max(4,int(total*19))):
        # Small refractive air rims distributed along the interior surface.
        at=random.uniform(.09,.91)*total
        for a,b in zip(path,path[1:]):
            d=(b-a).length
            if at>d:
                at-=d
                continue
            t=(b-a).normalized()
            s=Vector((-t.y,t.x,0))
            cross=random.uniform(-.127,.127)
            p=a+t*at+s*cross+UP*(.148-cross*cross*1.9)
            r=random.uniform(.008,.021)
            loop_glint('Trapped air bubble',p,r,bubble if i%3 else bubble_dull,lines)
            break

def straight(x0,y0,x1,y1,name='Glass sight tube'):
    water_section(name,[P(x0,y0),P(x1,y1)])

for i,(a,b) in enumerate([(141,198),(198,329),(329,459),(590,719),(719,853),(853,918)]):
    straight(a,572,b,572,'Main sight tube %02d'%(i+1))
for x in [198,329,459,590,719,853]:
    coupling(P(x,572),X)
for i,(a,b) in enumerate([(135,198),(198,330),(330,463)]):
    straight(a,833,b,833,'Lower branch tube %02d'%(i+1))
for x in [198,330,463]:
    coupling(P(x,833),X)

def brass_run(name,points,r=.215,coll=lines):
    sleeve(name,points,r,brass,coll,segments=38)
    for a,b in [(points[0],points[1]),(points[-1],points[-2])]:
        cyl('End sleeve',a,(b-a),r*1.04,.042,bright,coll,32,.009)

# The integral tee interrupts the main glass line and feeds the lower branch.
c=P(527,572)
brass_run('Cast three-way tee main',[P(459,572),P(590,572)],.218)
brass_run('Cast tee branch',[c,P(527,641)],.217)
cyl('Tee cast dome',c+UP*.045,UP,.217,.14,brass,lines,32,.038)
for y in [632,755]:
    coupling(P(527,y),Y,.270,.258)
straight(527,632,527,755,'Vertical branch sight tube')
p=P(527,833)
water_section('Swept branch elbow',elbow(p,Y,-X,.31,.516))

def terminal(cx,cy,inlet=False):
    paint,lens,spot=(green,green_lens,green_core) if inlet else (red,red_lens,red_core)
    label='Green intake' if inlet else 'Red delivery valve'
    p=xyz(cx,cy,.261)
    cyl(label+' base',p,UP,.397,.104,paint,bits,40,.024)
    cyl(label+' machined skirt',p+UP*.064,UP,.337,.046,darkbrass,bits,40,.014)
    cyl(label+' face',p+UP*.087,UP,.335,.096,paint,bits,40,.029)
    for i in range(8):
        a=pi*i/4+pi/8
        q=p+Vector((.339*cos(a),.339*sin(a),.103))
        cyl('Valve stud',q,UP,.033,.034,bright,bits,12,.007)
    side=1 if inlet else -1
    x=cx+10*side
    plate(label+' crown',(x-25,cy-38,x+25,cy+38),.673,.283,23,paint,bits,.053)
    plate(label+' raised lens',(x-17,cy-28,x+17,cy+28),.693,.085,16,lens,bits,.042)
    plate(label+' light center',(x-5.5,cy-14,x+5.5,cy+14),.697,.025,5,spot,bits,.010)
    nose=xyz(cx-32*side,cy,ZPIPE)
    cyl(label+' pipe socket',nose,X,.213,.137,paint,bits,36,.026)
    cyl(label+' socket seal',nose-X*side*.060,X,.201,.036,bright,bits,32,.009)

terminal(126,572)
terminal(126,833)
terminal(927,572,True)

plate('Two-lamp instrument panel',(434,129,616,203),.168,.143,37,border,bits,.045)
ring_panel('Instrument frame polished rim',(436,131,614,201),2,.171,34,edge,bits)
plate('Indicator plate recess',(442,136,608,195),.174,.05,29,inset,bits)
for x in [489,560]:
    p=xyz(x,166,.183)
    cyl('Status lamp brass socket',p,UP,.188,.056,brass,bits,36,.015)
    cyl('Status lamp glass lens',p+UP*.036,UP,.138,.049,red_lens,bits,36,.023)
    cyl('Status lamp amber highlight',p+UP*.063,UP,.059,.017,red_core,bits,28,.007)
for a,b in [((253,164),(406,164)),((646,164),(803,164)),((214,1390),(378,1390)),((671,1390),(835,1390))]:
    line_box('Fine brass rule',a,b,3,.093,brass,base)

plate('Pipe queue chassis',(62,1096,991,1310),.117,.183,35,border,tray,.046)
ring_panel('Queue machined rim',(66,1098,987,1307),2.1,.119,32,edge,tray)
plate('Queue inset field',(75,1108,977,1299),.134,.076,27,inset,tray)
for x in [91,962]:
    for y in [1121,1280]:
        screw(x,y,.148,.071,tray,.84)
slot_centers=[221,429,628,833]
for i,x in enumerate(slot_centers):
    plate('Queue socket %d'%(i+1),(x-86,1120,x+86,1279),.174,.085,25,edge,tray,.039)
    plate('Queue socket well',(x-80,1125,x+80,1274),.177,.053,21,inset,tray,.032)
    ring_panel('Active amber socket rim' if i==2 else 'Subtle socket rim',
               (x-83,1122,x+83,1277),3.2 if i==2 else 1.7,.187,23,amber if i==2 else edge,tray)

def queue_part(label,x,y,arms):
    c=xyz(x,y,.401)
    dirs={'E':X,'W':-X,'N':Y,'S':-Y}
    a,b=[dirs[k] for k in arms[:2]]
    if (a+b).length>.1:
        brass_run(label,elbow(c,a,b,.260,.424),.148,tray)
    else:
        brass_run(label,[c+a*.408,c+b*.408],.148,tray)
    if len(arms)==3:
        v=dirs[arms[2]]
        brass_run('Queue tee lower port',[c,c+v*.378],.148,tray)
        cyl('Queue tee cast crown',c+UP*.038,UP,.151,.092,brass,tray,24,.021)
    for arm in arms:
        v=dirs[arm]
        reach=.373 if arm=='S' and len(arms)==3 else .411
        end=c+v*reach
        coupling(end,v,.184,.142,tray)
        cyl('Queue socket interior',end+v*.082,v,.098,.009,rubber,tray,24,.003)
queue_part('Queue left elbow',217,1190,'ES')
queue_part('Queue straight',430,1199,'EW')
queue_part('Queue tee',628,1197,'EWS')
queue_part('Queue right elbow',833,1190,'WS')

plate('Advance button black housing',(394,1335,657,1458),.145,.139,60,inset,tray,.053)
plate('Advance button bronze lip',(399,1338,652,1454),.178,.081,55,darkbrass,tray,.038)
ring_panel('Advance button brushed metallic rim',(405,1343,646,1450),3.2,.181,51,bright,tray)
plate('Advance button green shell',(411,1347,640,1447),.214,.086,49,aqua,tray,.045)
ring_panel('Advance button glass reflection',(418,1353,634,1442),1.9,.216,42,aqua_line,tray)
verts=[xyz(506,1370,.220),xyz(554,1396,.220),xyz(506,1424,.220)]
arrow=mesh('Raised glass play arrow',verts,[(0,2,1)],tray,[aqua_arrow])
mod=arrow.modifiers.new('Glass thickness','SOLIDIFY')
mod.thickness=.017
bevel(arrow,.010)

camdata=bpy.data.cameras.new('True orthographic overhead')
cam=bpy.data.objects.new('Orthographic top camera',camdata)
studio.objects.link(cam)
cam.location=(0,0,15)
cam.rotation_euler=(0,0,0)
camdata.type='ORTHO'
camdata.ortho_scale=H/PX
scene.camera=cam

def area(name,loc,target,energy,size,color,width=None):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.color=color
    data.shape='RECTANGLE' if width else 'DISK'
    data.size=size
    if width: data.size_y=width
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Warm softbox upper left',(-4.4,4.2,8.1),(0,0,0),745,6.3,(1,.88,.73),4.4)
area('Cool strip upper right',(4.9,4.8,7.6),(0,0,0),718,6.6,(.64,.82,1),2.8)
area('Lower reflection card',(-3.5,-6,5.9),(0,-1,0),220,4.7,(.72,.90,1),1.4)
area('Front narrow warm edge',(1,-4.8,4.0),(0,-1,0),118,4.8,(1,.86,.65),1.35)

def point(name,loc,power,color,radius):
    light=bpy.data.lights.new(name,'POINT')
    light.energy=power
    light.color=color
    light.shadow_soft_size=radius
    obj=bpy.data.objects.new(name,light)
    studio.objects.link(obj)
    obj.location=loc

for x,y in [(268,572),(397,572),(656,572),(785,572),(527,695),(395,833),(267,833)]:
    point('Refracted blue bounce',xyz(x,y,.374),3.4,(.065,.62,1),.21)
for x in (489,560):
    point('Lamp spill',xyz(x,166,.278),1.4,(1,.20,.024),.13)

scene['Reference'] = 'Pipe Panic realistic top-view concept, original framing 1051 x 1496'
scene['View'] = 'True orthographic camera, rotation XYZ 0, 0, 0'
scene['Geometry'] = '42 editable square tiles. Glass walls, liquid cores, valve bodies, fittings and covers are separate models.'
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.region_3d.view_camera_zoom=-1
bpy.context.preferences.filepaths.save_version=0
if os.environ.get('PIPEPANIC_EXPORT_ASSETS') != '1':
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'PipePanic-top.blend'))
print('Editable scene:',len(scene.objects),'objects,',len(tiles),'tile materials,',scene.camera.name)

