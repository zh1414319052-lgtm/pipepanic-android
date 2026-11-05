"""PipePanic / Pump Station. Blender 5.2 still concept. All meshes are procedural."""
from pathlib import Path
from math import sin, cos, pi
import os
import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).parent
W, H = 1080, 1660
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "PipePanic | Pump station 02"
scene.render.engine = 'CYCLES'
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.cycles.transmission_bounces = 3
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.world = bpy.data.worlds.new('Blue-grey studio')
scene.world.use_nodes = True
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (.095,.132,.193,1)
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[1].default_value = .35

def srgb(hexcolor):
    v = [int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4 for x in v)

def pbr(name, color, roughness=.36, metal=0, emission=None, power=0, coat=.16, transmission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*srgb(color),1)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*srgb(color),1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Transmission Weight'].default_value = transmission
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*srgb(emission),1)
        bsdf.inputs['Emission Strength'].default_value = power
    return mat

def flat(name, color, strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n = mat.node_tree.nodes
    n.clear()
    glow = n.new('ShaderNodeEmission')
    glow.inputs[0].default_value = (*srgb(color),1)
    glow.inputs[1].default_value = strength
    out = n.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(glow.outputs[0],out.inputs[0])
    mat.diffuse_color=(*srgb(color),1)
    return mat

def texture(mat, colors, scale, amount):
    tree=mat.node_tree
    n=tree.nodes
    shader=next(v for v in n if v.type=='BSDF_PRINCIPLED')
    noise=n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=scale
    noise.inputs['Detail'].default_value=2.0
    coord=n.new('ShaderNodeTexCoord')
    tree.links.new(coord.outputs['Object'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB')
    for item,c in zip(ramp.color_ramp.elements,colors): item.color=(*srgb(c),1)
    tree.links.new(noise.outputs['Fac'],ramp.inputs[0])
    tree.links.new(ramp.outputs[0],shader.inputs['Base Color'])
    bump=n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=amount
    bump.inputs['Distance'].default_value=.035
    tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
    tree.links.new(bump.outputs[0],shader.inputs['Normal'])

def group(name):
    c=bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

studio=group('01 · Studio')
board_group=group('02 · Board and frame')
network=group('03 · Pipe network')
queue_group=group('04 · Queue models')
hud=group('05 · Interface')

def relink(obj,collection):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def surface(obj, material, collection):
    obj.data.materials.append(material)
    return relink(obj,collection)

def bevel(obj, width, segments=3):
    mod=obj.modifiers.new('Machined radius','BEVEL')
    mod.width=width
    mod.segments=segments
    mod=obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    mod.keep_sharp=True

def block(name, pos, size, mat, collection, radius=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if radius: bevel(obj,radius)
    return surface(obj,mat,collection)

def cylinder(name, pos, axis, radius, depth, mat, collection, sides=32, edge=.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=radius,depth=depth,location=pos)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    for poly in obj.data.polygons:
        poly.use_smooth=len(poly.vertices)==4
    if edge: bevel(obj,edge)
    return surface(obj,mat,collection)

def mesh_obj(name, vertices, faces, mats, coll):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    coll.objects.link(obj)
    for mat in mats: mesh.materials.append(mat)
    return obj

Z=(0,0,1)
floor=pbr('Ground · Petrol blue','0C2536',.63,0,coat=0)
texture(floor,('091D30','102C3D'),.32,.035)
frame=pbr('Frame · Enamel steel','174154',.26,.42)
shadow=pbr('Inset · Graphite','081E2C',.56,.22)
bronze=pbr('Collars · Satin brass','D4A264',.29,.72)
copper=pbr('Body · Aged bronze','886249',.36,.57)
steel=pbr('Mount · Nickel gunmetal','405C68',.33,.69)
rubber=pbr('Gaskets','10232D',.49,.12)
tile_a=pbr('Tile A · Blue stone','294753',.46,.23)
tile_b=pbr('Tile B · Blue stone','34515A',.47,.21)
texture(tile_a,('233D49','345461'),5.5,.055)
texture(tile_b,('2D4652','3D5961'),5.5,.055)
wet_tile=pbr('Channel · Teal stone','285561',.45,.22)
wet=pbr('Flow · Turquoise viewing jacket','1AADC1',.21,.24,'1EC1DA',.31,.42,.12)
wet_edge=pbr('Flow · Fine surface highlight','72E4EC',.23,.21,'43D2EA',.42,.26)
seal_red=pbr('Outlet · Vermilion enamel','C74F39',.24,.36,'D15A3C',.09,.43)
seal_green=pbr('Inlet · Viridian enamel','38A876',.25,.34,'42C688',.12,.37)
green_glow=pbr('Inlet · Green glass','72E5A6',.26,.21,'53EE9C',.56)
red_glow=pbr('Outlet · Red glass','FF8C67',.24,.22,'FF6D46',.50)
wall=pbr('Walls · Blackened alloy','252F38',.49,.53)
stripe=pbr('Warning · Muted amber','BC8747',.42,.40)
block('Studio floor',(0,0,-.68),(200,200,.08),floor,studio,0)
block('Chassis · Die cast',(0,0,-.31),(7.44,6.44,.47),frame,board_group,.16)
block('Upper rim',(0,0,-.094),(7.34,6.34,.25),frame,board_group,.105)
block('Recessed gasket',(0,0,.023),(7.10,6.10,.075),shadow,board_group,.09)
block('Front brass inlay',(0,-3.218,-.18),(6.72,.038,.025),bronze,board_group,.012)
block('Front enamel seam',(0,-3.232,-.28),(6.86,.035,.028),shadow,board_group,.013)
for sign in [-1,1]:
    block('Chassis reinforcement',(sign*3.26,-3.217,-.254),(.49,.09,.27),steel,board_group,.045)
    for y in (-2.84,2.84):
        cylinder('Rim bolt',(sign*3.55,y,.055),Z,.060,.034,bronze,board_group,sides=12,edge=.005)
        block('Bolt slot',(sign*3.55,y,.075),(.068,.013,.005),rubber,board_group,.002)

def cell(col,row):
    return Vector((col-3,2.5-row,0))

wet_cells={(i,2) for i in range(7)} | {(3,3),(3,4),(2,4),(1,4),(0,4)}
walls={(0,1),(5,1),(5,3),(6,3),(2,5)}
for row in range(6):
    for col in range(7):
        x,y,_=cell(col,row)
        mat=wet_tile if (col,row) in wet_cells else (tile_a if (row+col)%2==0 else tile_b)
        block(f'Grid {col+1} / {row+1}',(x,y,.012),(.966,.966,.129),mat,board_group,.057)
        if (col,row) in walls:
            block('Sealed maintenance cover',(x,y,.099),(.78,.78,.105),wall,board_group,.067)
            for j in [-1,0,1]:
                hatch=block('Hazard chevron',(x+j*.175,y,.154),(.095,.47 if j else .59,.014),stripe,board_group,.008)
                hatch.rotation_euler.z=-.69
            for ox,oy in [(-.315,-.315),(.315,.315)]:
                cylinder('Maintenance rivet',(x+ox,y+oy,.159),Z,.026,.022,steel,board_group,12,.004)

D={'N':Vector((0,1,0)),'E':Vector((1,0,0)),'S':Vector((0,-1,0)),'W':Vector((-1,0,0))}
PIPE_Z=.287

def tube(name, points, radius, materials, collection, wet_skin=False):
    sides=24
    vertices=[]
    faces=[]
    for index,point in enumerate(points):
        tangent=(points[min(index+1,len(points)-1)]-points[max(index-1,0)]).normalized()
        side=Vector((-tangent.y,tangent.x,0))
        for j in range(sides):
            theta=2*pi*j/sides
            vertices.append(point+radius*(cos(theta)*side+sin(theta)*Vector(Z)))
    for index in range(len(points)-1):
        for j in range(sides):
            a=index*sides+j
            b=index*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    obj=mesh_obj(name,vertices,faces,materials,collection)
    for poly in obj.data.polygons:
        poly.use_smooth=True
        if wet_skin:
            # A dark lower housing, plus a clear turquoise top window.
            poly.material_index=0 if 0 <= poly.index%sides < sides//2 else 1
    return obj

def elbow_points(c,a,b,reach=.51):
    bend=.265
    o=c+(a+b)*bend
    result=[c+a*reach,c+a*bend]
    for j in range(1,12):
        theta=(pi/2)*j/12
        result.append(o-b*bend*cos(theta)-a*bend*sin(theta))
    return result+[c+b*bend,c+b*reach]

def collar(pos,axis,collection,mat=bronze,mini=False):
    cylinder('Coupling',pos,axis,.225,.135,mat,collection,32,.024)
    cylinder('Gasket',pos,axis,.228,.036,rubber,collection,32,.007)
    for s in (-1,1):
        cylinder('Coupling shoulder',pos+axis*(s*.054),axis,.232,.027,mat,collection,32,.008)
    if not mini:
        for s in (-1,1):
            side=Vector((-axis.y,axis.x,0))
            p=pos+.199*side*s+Vector((0,0,.107))
            cylinder('Coupling pin',p,Z,.032,.035,steel,collection,10,.007)

def pipe(label, pos, arms, filled, collection, reach=.50, collars_at_ends=False):
    c=Vector(pos)+Vector((0,0,PIPE_Z))
    vectors=[D[x] for x in arms]
    materials=[wet,steel] if filled else [copper]
    paths=[]
    if len(vectors)==2:
        a,b=vectors
        paths=[[c+a*reach,c+b*reach]] if (a+b).length < .1 else [elbow_points(c,a,b,reach)]
    else:
        a,b=next((a,b) for a in vectors for b in vectors if (a+b).length<.1)
        paths=[[c+a*reach,c+b*reach]]
        paths.extend([[c,c+p*reach] for p in vectors if p!=a and p!=b])
    for points in paths:
        tube(label,points,.174,materials,collection,filled)
    if len(arms)==3:
        cylinder('Tee access cap',c+Vector((0,0,.148)),Z,.124,.084,bronze,collection,24,.016)
        cylinder('Tee center glass',c+Vector((0,0,.196)),Z,.086,.025,wet if filled else copper,collection,24,.008)
    if collars_at_ends:
        for v in vectors:
            collar(c+v*(reach-.029),v,collection,mini=True)
            cylinder('Pipe opening',c+v*(reach+.041),v,.123,.023,rubber,collection,24,.004)

network_arms={
    (6,2):'W',(5,2):'EW',(4,2):'EW',(3,2):'ESW',(2,2):'EW',(1,2):'EW',(0,2):'E',
    (3,3):'NS',(3,4):'NW',(2,4):'EW',(1,4):'EW',(0,4):'E'
}
terminals={(6,2):('Inlet',seal_green,green_glow),(0,2):('Outlet A',seal_red,red_glow),(0,4):('Outlet B',seal_red,red_glow)}
for (x,y),arms in network_arms.items():
    p=cell(x,y)
    if (x,y) in terminals:
        label,paint,glow=terminals[(x,y)]
        v=D[arms]
        c=p+Vector((0,0,PIPE_Z))
        tube(label+' port',[c+v*.15,c+v*.5],.168,[wet,steel],network,True)
        cylinder(label+' base',p+Vector((0,0,.136)),Z,.344,.107,steel,network,32,.027)
        cylinder(label+' face',p+Vector((0,0,.253)),Z,.281,.215,paint,network,32,.05)
        cylinder(label+' crown rim',p+Vector((0,0,.393)),Z,.239,.065,paint,network,32,.02)
        cylinder(label+' light ring',p+Vector((0,0,.434)),Z,.195,.028,glow,network,40,.012)
        cylinder(label+' hub',p+Vector((0,0,.455)),Z,.144,.047,rubber,network,32,.014)
        for j in range(4):
            ang=j*pi/2+pi/4
            cylinder(label+' crown screw',p+Vector((.214*cos(ang),.214*sin(ang),.431)),Z,.024,.021,bronze,network,12,.004)
    else:
        pipe(f'Wet {x},{y} {arms}',p,arms,True,network)

edges=set()
for (x,y),arms in network_arms.items():
    p=cell(x,y)
    for arm in arms:
        v=D[arm]
        adjacent=(x+int(v.x),y-int(v.y))
        reverse={'N':'S','S':'N','W':'E','E':'W'}[arm]
        assert reverse in network_arms[adjacent]
        edge=tuple(sorted(((x,y),adjacent)))
        if edge in edges: continue
        edges.add(edge)
        collar(p+v*.5+Vector((0,0,PIPE_Z)),v,network)
# Unconnected pieces retain a warm metal body.
for x,y,arms in [(2,0,'ES'),(5,5,'EW')]:
    pipe(f'Dry {x},{y}',cell(x,y),arms,False,network,reach=.375,collars_at_ends=True)

# Camera and light rig.
cam_data=bpy.data.cameras.new('Portrait orthographic')
cam=bpy.data.objects.new('Portrait camera',cam_data)
studio.objects.link(cam)
cam.location=(.83,-10.8,13)
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'
cam.data.ortho_scale=14
scene.camera=cam
frame_pts=[Vector((x,y,z)) for x in (-3.72,3.72) for y in (-3.22,3.22) for z in (-.54,.43)]
bpy.context.view_layer.update()
def projected():
    return [world_to_camera_view(scene,cam,p) for p in frame_pts]
before=projected()
span=max(v.x for v in before)-min(v.x for v in before)
cam.data.ortho_scale*=span/.87
bpy.context.view_layer.update()
bbox=projected()
basis=cam.rotation_euler.to_matrix()
view=cam.data.view_frame(scene=scene)
x0,x1=min(v.x for v in view),max(v.x for v in view)
y0,y1=min(v.y for v in view),max(v.y for v in view)
center_x=(min(v.x for v in bbox)+max(v.x for v in bbox))/2
center_y=(min(v.y for v in bbox)+max(v.y for v in bbox))/2
cam.location+=basis@Vector(((center_x-.50)*(x1-x0),(center_y-.50)*(y1-y0),0))
bpy.context.view_layer.update()
bbox=projected()
print('board pixels', min(v.x for v in bbox)*W, (1-max(v.y for v in bbox))*H,
      max(v.x for v in bbox)*W, (1-min(v.y for v in bbox))*H)

def area(name, pos, target, power, size, color, size_y=None):
    light=bpy.data.lights.new(name,'AREA')
    light.energy=power
    light.color=color
    if size_y is not None:
        light.shape='RECTANGLE'
        light.size=size
        light.size_y=size_y
    else:
        light.shape='DISK'
        light.size=size
    obj=bpy.data.objects.new(name,light)
    studio.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Key · warm broadbox',(-4.2,-3.0,8.4),(0,0,0),1180,7.0,(1,.85,.69),5.0)
area('Edge · arctic blue',(4.9,3.9,6.0),(0,0,0),1320,5.0,(.54,.78,1),3.0)
area('Fill · cool overhead',(0,-1.5,10),(0,0,0),450,8.5,(.77,.90,1))
area('Back card',(-4,5.8,4.4),(0,0,0),420,5.0,(.63,.84,1))

fonts={w:bpy.data.fonts.load(str(HERE/f'ConceptNoto-{w}.ttf')) for w in ('Regular','Bold')}
unit=(x1-x0)/W
def cam_coord(px,py,z):
    return Vector((x0+px*unit,y1-py*unit,z))

def screen(px,py,z):
    return cam.matrix_world @ cam_coord(px,py,z)

def only_camera(obj):
    obj.visible_shadow=False
    obj.visible_diffuse=False
    obj.visible_glossy=False
    obj.visible_transmission=False
    return obj

ink=flat('HUD · Ice white','F3F7F2',1.28)
muted=flat('HUD · Secondary','A6C3C9',1.13)
tint=flat('HUD · Cyan','84E5DE',1.14)
panel=flat('HUD · Glass blue-black','102A3A',.77)
line=flat('HUD · Rim blue','426E7A',.80)
badge=flat('HUD · Blue dark','153E4A',.86)
gold=flat('HUD · Brass','E6BB83',1.10)
bright=flat('HUD · Action','76DAD4',1.10)
button_ink=flat('HUD · Dark ink','11252C',.9)
em_green=flat('HUD · Emerald','7CF4B5',1.15)
em_red=flat('HUD · Coral','F8876F',1.15)

def rounded(name,x,y,w,h,r,mat,z=-9.0):
    vertices=[]
    centers=[(x+w-r,y+r),(x+w-r,y+h-r),(x+r,y+h-r),(x+r,y+r)]
    for i,(cx,cy) in enumerate(centers):
        for j in range(9):
            a=(-pi/2+i*pi/2)+pi/2*j/8
            vertices.append(screen(cx+r*cos(a),cy+r*sin(a),z))
    return only_camera(mesh_obj(name,vertices,[tuple(reversed(range(len(vertices))))],[mat],hud))

def label(body,x,y,size,mat,weight='Regular',align='LEFT',z=-8.96, tracking=1):
    data=bpy.data.curves.new(body,type='FONT')
    data.font=fonts[weight]
    data.body=body
    data.size=size*unit
    data.space_character=tracking
    data.align_x=align
    data.align_y='CENTER'
    data.resolution_u=10
    obj=bpy.data.objects.new('HUD · '+body,data)
    hud.objects.link(obj)
    obj.location=screen(x,y,z)
    obj.rotation_euler=cam.rotation_euler
    obj.data.materials.append(mat)
    return only_camera(obj)

# Main HUD. Pixel coordinates use the render's portrait frame.
label('PIPE PANIC  /  PUMP STATION',72,82,32,muted,'Bold',tracking=1.13)
rounded('Preview tag',827,55,181,52,25,line)
rounded('Preview tag inset',829,57,177,48,23,panel,-8.995)
label('3D 概念',917,81,27,tint,'Bold','CENTER')
label('水管危机',66,174,118,ink,'Bold')
label('一进多出  /  关卡 02',74,266,43,muted)
rounded('Section rule',73,314,933,2,1,line)
rounded('Status outline',72,349,936,117,23,line)
rounded('Status card',74,351,932,113,21,panel,-8.994)
rounded('Status point',100,381,14,14,7,em_green,-8.98)
label('通关成功',132,396,45,ink,'Bold')
label('已接通出口',725,405,32,muted,'Regular','RIGHT')
label('02 / 02',980,408,61,tint,'Bold','RIGHT')

# Small endpoint labels projected on the top face rather than floating off the tiles.
for coord,body,material in [((6,2),'IN',em_green),((0,2),'A',em_red),((0,4),'B',em_red)]:
    p=cell(*coord)+Vector((0,0,.508))
    point=world_to_camera_view(scene,cam,p)
    label(body,point.x*W,(1-point.y)*H,31 if body=='IN' else 35,material,'Bold','CENTER')

rounded('Queue panel rim',72,1215,936,275,27,line)
rounded('Queue panel',74,1217,932,271,25,panel,-8.994)
label('剩余管件',104,1264,37,ink,'Bold')
label('PIPE QUEUE  /  04',978,1264,26,muted,'Bold','RIGHT',tracking=1.1)
queue_slots=(197,425,653,881)
for idx,(x,arms) in enumerate(zip(queue_slots,('EW','NW','ESW','NS'))):
    rounded('Slot rim',x-94,1303,188,148,19,gold if idx==0 else line,-8.983)
    rounded('Slot well',x-92,1305,184,144,17,badge if idx==0 else panel,-8.981)
    before=set(queue_group.objects)
    pipe('Queue '+arms,(0,0,0),arms,False,queue_group,reach=.43,collars_at_ends=True)
    mapping=cam.matrix_world @ Matrix.Translation(cam_coord(x,1379,-8.72)) @ Matrix.Rotation(.51,4,'X') @ Matrix.Rotation(.09,4,'Z') @ Matrix.Scale(1.06,4)
    for obj in set(queue_group.objects)-before:
        obj.matrix_world=mapping @ obj.matrix_world
        only_camera(obj)
queue_light=screen(470,1227,-5.3)
area('Queue softbox',queue_light,screen(530,1385,-8.7),440,3.5,(1,.90,.76),2)
rounded('Retry edge',72,1522,258,88,20,line)
rounded('Retry inset',74,1524,254,84,18,panel,-8.993)
label('重试',201,1566,43,ink,'Bold','CENTER')
rounded('Next level',351,1522,657,88,20,bright)
label('下一关',679,1566,45,button_ink,'Bold','CENTER')
arrow=[screen(x,y,-8.95) for x,y in [(943,1556),(957,1566),(943,1576),(936,1570),(943,1566),(936,1562)]]
only_camera(mesh_obj('Next arrow',arrow,[tuple(range(len(arrow)))],[button_ink],hud))

# Save an editable studio file with its licensed font data packed.
scene['Font'] = 'Noto Sans SC · SIL Open Font License 1.1'
scene['Brief'] = 'Portrait Android game concept. Both outlets are fed by a single visible 3D tee.'
scene['Pipe network connections'] = len(edges)
if os.environ.get('PIPEPANIC_BUILD_MESHES') != '1':
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'PipePanic3D.blend'))
print('scene ready',len(scene.objects),'objects',len(edges),'connected edges')

