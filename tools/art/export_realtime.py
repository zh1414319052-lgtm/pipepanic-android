"""Bake the accepted Blender geometry into compact WebGL vertex buffers."""
import base64
import json
from math import cos, sin, pi
import os
from pathlib import Path
import runpy
import struct

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
os.environ['PIPEPANIC_BUILD_MESHES']='1'
art=runpy.run_path(str(HERE/'create_scene.py'))
block, cylinder, tube, pipe, collar, group = (art[k] for k in ('block','cylinder','tube','pipe','collar','group'))
shadow, frame, tile_a, tile_b, wet, steel, wall, stripe, bronze, copper, rubber, red, green, red_glow, green_glow = (
    art[k] for k in ('shadow','frame','tile_a','tile_b','wet','steel','wall','stripe','bronze','copper','rubber','seal_red','seal_green','red_glow','green_glow'))
mesh_group=group('Game mesh export')
Z=(0,0,1)
E=Vector((1,0,0))
W=Vector((-1,0,0))
palette=[]
material_ids={}
models={}
header=struct.Struct('<7h')

def material_index(material):
    if material.name in material_ids:
        return material_ids[material.name]
    p=next(node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    record=[round(value,5) for value in p.inputs['Base Color'].default_value[:3]]
    record+= [round(p.inputs['Metallic'].default_value,3), round(p.inputs['Roughness'].default_value,3)]
    record.append(1 if material.name==wet.name else 0)
    material_ids[material.name]=len(palette)
    palette.append(record)
    return material_ids[material.name]

def export(name, build):
    before=set(mesh_group.objects)
    build()
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    packed=bytearray()
    count=0
    for obj in sorted(set(mesh_group.objects)-before,key=lambda item:item.name):
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        mesh.calc_loop_triangles()
        world=evaluated.matrix_world
        normal_matrix=world.to_3x3().inverted().transposed()
        for tri in mesh.loop_triangles:
            material=material_index(mesh.materials[tri.material_index])
            for loop in tri.loops:
                vertex=world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                normal=(normal_matrix @ mesh.corner_normals[loop].vector).normalized()
                packed+=header.pack(*(round(v*8192) for v in vertex),
                                    *(round(v*32767) for v in normal),material)
                count+=1
        evaluated.to_mesh_clear()
    models[name]=base64.b64encode(packed).decode('ascii')
    print('exported',name,count)

def base():
    block('Main chassis',(0,0,-.325),(2,2,.48),frame,mesh_group,.044)
    block('Upper rim',(0,0,-.103),(1.984,1.984,.23),frame,mesh_group,.044)
    block('Recessed gasket',(0,0,.018),(1.952,1.952,.084),shadow,mesh_group,.032)

def grate():
    block('Maintenance cover',(0,0,.105),(.80,.80,.103),wall,mesh_group,.065)
    for i in (-1,0,1):
        bar=block('Warning bar',(i*.175,0,.160),(.091,.49 if i else .59,.014),stripe,mesh_group,.006)
        bar.rotation_euler.z=-.69
    for sign in (-1,1):
        cylinder('Grate rivet',(sign*.31,sign*.31,.165),Z,.029,.026,steel,mesh_group,12,.004)

def terminal(inlet):
    label='Inlet' if inlet else 'Outlet'
    paint,glow,axis=(green,green_glow,W) if inlet else (red,red_glow,E)
    c=Vector((0,0,.287))
    tube(label+' port',[c+axis*.15,c+axis*.5],.168,[wet,steel],mesh_group,True)
    cylinder(label+' base',(0,0,.136),Z,.344,.107,steel,mesh_group,24,.025)
    cylinder(label+' body',(0,0,.253),Z,.281,.215,paint,mesh_group,24,.05)
    cylinder(label+' crown',(0,0,.393),Z,.239,.065,paint,mesh_group,24,.02)
    cylinder(label+' indicator',(0,0,.434),Z,.195,.028,glow,mesh_group,24,.012)
    cylinder(label+' hub',(0,0,.455),Z,.144,.047,rubber,mesh_group,24,.014)

def capped():
    c=Vector((0,0,.287))
    tube('Capped pipe',[c,c+W*.5],.174,[wet,steel],mesh_group,True)
    cylinder('Closed end',c,E,.178,.10,copper,mesh_group,24,.02)

def coupling():
    # A short turned profile keeps the repeated couplers light on mobile GPUs.
    profile=[(-.071,.175),(-.071,.216),(-.059,.231),(-.033,.231),(-.025,.213),
             (.025,.213),(.033,.231),(.059,.231),(.071,.216),(.071,.175)]
    sides=20
    vertices=[(x,r*cos(2*pi*j/sides),.287+r*sin(2*pi*j/sides))
              for x,r in profile for j in range(sides)]
    faces=[]
    for i in range(len(profile)-1):
        for j in range(sides):
            a=i*sides+j
            b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    obj=art['mesh_obj']('Turned brass coupling',vertices,faces,[bronze,rubber],mesh_group)
    for p in obj.data.polygons:
        p.use_smooth=True
        p.material_index=1 if p.index//sides==4 else 0

export('deck',base)
export('tileA',lambda:block('Grid tile',(0,0,.012),(.963,.963,.129),tile_a,mesh_group,.049))
export('tileB',lambda:block('Grid tile',(0,0,.012),(.963,.963,.129),tile_b,mesh_group,.049))
export('wall',grate)
export('trim',lambda:block('Brass trim',(0,0,-.19),(2,.026,.029),bronze,mesh_group,.009))
export('bolt',lambda:cylinder('Rim bolt',(0,0,.045),Z,.054,.038,bronze,mesh_group,12,.006))
export('inlet',lambda:terminal(True))
export('outlet',lambda:terminal(False))
export('straight',lambda:pipe('Straight',(0,0,0),'EW',True,mesh_group))
export('elbow',lambda:pipe('Elbow',(0,0,0),'NE',True,mesh_group))
export('tee',lambda:pipe('Tee',(0,0,0),'ESW',True,mesh_group))
export('cross',lambda:pipe('Cross',(0,0,0),'NESW',True,mesh_group))
export('cap',capped)
export('collar',coupling)
out=HERE.parent.parent/'app/src/main/assets/jspp/pump-meshes.js'
out.write_text('// Generated by tools/art/export_realtime.py from the Blender scene.\nvar pumpMeshData = '+json.dumps(
    {'palette':palette,'models':models},separators=(',',':'))+';\n',encoding='utf8')
print('written',out,out.stat().st_size)

