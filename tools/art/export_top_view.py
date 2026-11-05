"""Build the modular top-view meshes from the approved Blender material and model recipe."""
import base64
import json
import math
import os
from pathlib import Path
import runpy
import struct

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
os.environ['PIPEPANIC_EXPORT_ASSETS'] = '1'
art = runpy.run_path(str(HERE / 'rebuild_top_reference.py'))
plate, cyl, sleeve, elbow = (art[key] for key in ('plate', 'cyl', 'sleeve', 'elbow'))
mesh, xyz, X, Y, UP = (art[key] for key in ('mesh', 'xyz', 'X', 'Y', 'UP'))
brass, bright, darkbrass, rubber, glass = (art[key] for key in ('brass','bright','darkbrass','rubber','glass'))
border, inset, edge = (art[key] for key in ('border','inset','edge'))
coll = art['group']('Modular game models')
palette, indices, models = [], {}, {}
vertex = struct.Struct('<7h')
origin = xyz(525.5,748)
z = .349

def paint_index(material):
    if material.name not in indices:
        node = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        rgb = list(node.inputs['Base Color'].default_value[:3])
        if material.name.startswith('Sight glass'):
            kind = 1
        elif material.name.startswith('Slate tile'):
            kind = 2
        else:
            kind = 3 if 'hotspot' in material.name.lower() or 'lens' in material.name.lower() else 0
        indices[material.name] = len(palette)
        palette.append([round(v,5) for v in rgb] + [
            round(node.inputs['Metallic'].default_value,3), round(node.inputs['Roughness'].default_value,3), kind])
    return indices[material.name]

def export(name, objects, offset=origin):
    for obj in objects:
        for modifier in obj.modifiers:
            if modifier.type=='BEVEL':
                modifier.segments=1
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    packed = bytearray()
    for obj in sorted(objects,key=lambda o:o.name):
        current = obj.evaluated_get(deps)
        data = current.to_mesh()
        data.calc_loop_triangles()
        matrix = current.matrix_world
        normal_matrix = matrix.to_3x3().inverted().transposed()
        for tri in data.loop_triangles:
            material = paint_index(data.materials[tri.material_index])
            for loop in tri.loops:
                p = matrix @ data.vertices[data.loops[loop].vertex_index].co - offset
                n = (normal_matrix @ data.corner_normals[loop].vector).normalized()
                packed.extend(vertex.pack(*(round(v*8192) for v in p), *(round(v*32767) for v in n),material))
        current.to_mesh_clear()
    models[name] = base64.b64encode(packed).decode('ascii')
    print(name, len(packed)//vertex.size)

def make(name, build):
    before = set(coll.objects)
    build()
    bpy.context.view_layer.update()
    export(name,set(coll.objects)-before)

def panel(name,w,h,top,depth,mat,r=6):
    return plate(name,(525.5-w*65,748-h*65,525.5+w*65,748+h*65),top,depth,r,mat,coll)

def deck():
    panel('Blue cast frame',2,2,.019,.18,border,7)
    panel('Black recessed bed',1.88,1.88,.026,.064,inset,4)

def rail():
    c=Vector((0,0,.117))
    sleeve('Steel return line',[c-X,c+X],.066,edge,coll,segments=14)
    for x in (-.68,.0,.68):
        cyl('Return-line bracket',c+X*x,X,.083,.10,border,coll,12,.009)

def terminal(intake):
    side = -1 if intake else 1
    cx,cy = (927,572) if intake else (126,572)
    prefix = 'Green intake' if intake else 'Red delivery valve'
    before = set(coll.objects)
    # Use the machined housing and illuminated lens from the approved shot.
    for ob in art['bits'].objects:
        if not ob.name.startswith((prefix,'Valve stud')):
            continue
        c=sum((ob.matrix_world @ Vector(v) for v in ob.bound_box),Vector())/8
        center=xyz(cx,cy)
        if abs(c.y-center.y)>.46 or abs(c.x-center.x)>.57:
            continue
        clone=ob.copy()
        clone.location += origin-xyz(cx,cy,.108)
        coll.objects.link(clone)
    c=Vector((0,0,z))
    sleeve('Terminal sight pipe',[c+X*(side*.24),c+X*(side*.5)],.151,glass,coll,segments=20)

def pipe(shape):
    c=Vector((0,0,z))
    if shape=='elbow':
        paths=[elbow(c,Y,X,.307,.50)]
    elif shape=='cap':
        paths=[[c-X*.50,c-X*.028]]
    else:
        paths=[[c-X*.5,c+X*.5]]
        if shape in ('tee','cross'):
            paths.append([c-Y*.5,c+Y*(.5 if shape=='cross' else .032)])
    for path in paths:
        sleeve('Curved sight glass',path,.157,glass,coll,segments=18)
    if shape in ('tee','cross'):
        cyl('Cast brass junction',c+UP*.012,UP,.212,.29,brass,coll,20,.026)
        for axis in (X, Y):
            if axis==X or shape=='cross':
                sleeve('Cast junction port',[c-axis*.236,c+axis*.236],.183,brass,coll,segments=16)
            else:
                sleeve('Cast tee lower port',[c,c-axis*.236],.183,brass,coll,segments=16)
    if shape=='cap':
        cyl('Machined end cap',c,X,.178,.09,darkbrass,coll,20,.013)

def collar():
    profile = [(-.081,.154),(-.081,.182),(-.068,.195),(-.044,.195),(-.035,.213),
               (.035,.213),(.044,.195),(.068,.195),(.081,.182),(.081,.154)]
    sides = 16
    vertices = [(x,r*math.cos(math.tau*j/sides),z+r*math.sin(math.tau*j/sides))
                for x,r in profile for j in range(sides)]
    faces = [(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
             for i in range(len(profile)-1) for j in range(sides)]
    obj=mesh('Brass union with turned shoulders',vertices,faces,coll,[brass,bright,darkbrass])
    for poly in obj.data.polygons:
        poly.use_smooth=True
        poly.material_index=(2,1,1,2,0,2,1,1,2)[poly.index//sides]

def bolt():
    cyl('Steel fastener',(0,0,.061),UP,.062,.045,edge,coll,12,.010)
    cyl('Recessed slot',(0,0,.085),X,.008,.087,inset,coll,8,.003)

make('deck',deck)
make('rail',rail)
make('bolt',bolt)
for i in range(4):
    export('tile'+str(i),[bpy.data.objects[f'Tile {i+1},1']],xyz(74+129.25*i+63.2,311.35,.098))
center=xyz(786,442,.085)
wall=[]
for ob in art['board'].objects:
    if not ob.name.startswith(('Locked maintenance','Maintenance plate','Worn safety','Recessed washer','Slotted fastener','Recessed screw')):
        continue
    c=sum((ob.matrix_world @ Vector(v) for v in ob.bound_box),Vector())/8
    if abs(c.x-center.x)<.5 and abs(c.y-center.y)<.52:
        wall.append(ob)
export('wall',wall,center)
make('inlet',lambda:terminal(True))
make('outlet',lambda:terminal(False))
for name in ('straight','elbow','tee','cross','cap'):
    make(name,lambda:pipe(name))
make('collar',collar)
assert any(p[5]==1 for p in palette) and any(p[5]==2 for p in palette)
out = HERE.parent.parent/'app/src/main/assets/jspp/pump-meshes.js'
out.write_text('// Generated by tools/art/export_top_view.py.\nvar pumpMeshData = '+json.dumps(
    {'palette':palette,'models':models},separators=(',',':'))+';\n',encoding='utf8')
print('WROTE',out,out.stat().st_size)
