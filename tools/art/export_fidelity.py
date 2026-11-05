"""Cycles fixed-camera appearance on reusable real meshes. Blender 5.2.

Every playable orientation is lit independently. The runtime must not rotate
these baked highlights. Glass and water are separate runtime geometry.
"""
import os, runpy, json, math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
OUT=ROOT/'art/fidelity'
OUT.mkdir(parents=True,exist_ok=True)
os.environ['PIPEPANIC_EXPORT_ASSETS']='1'
a=runpy.run_path(str(HERE/'rebuild_top_reference.py'))
s=bpy.context.scene
s.view_settings.view_transform='Filmic'
s.view_settings.look='Medium High Contrast'
s.view_settings.exposure=0
s.cycles.samples=48
s.cycles.use_denoising=True
s.render.film_transparent=True
s.render.resolution_x=s.render.resolution_y=256
s.render.image_settings.color_mode='RGBA'
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences
 prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 s.cycles.device='GPU'
except Exception as e:print('GPU fallback',e)
cam=s.camera;cam.location=(0,0,15);cam.data.ortho_scale=1.40
for ob in s.objects:
 if ob.type not in ('CAMERA','LIGHT'):ob.hide_render=True

X,Y,Z=a['X'],a['Y'],a['UP']
center=Vector((0,0,.457))
masks=[8,2,9,12,6,3,13,14,7,11,15,10,5,8,1,2,4]
vectors={1:Y,2:X,4:-Y,8:-X}
assets=[]

def panel(name,w,h,top,depth,mat,r=7,coll=None):
 return a['plate'](name,(525.5-w*65,748-h*65,525.5+w*65,748+h*65),top,depth,r,mat,coll)

def tile(coll,i=0):
 return panel('Slate tile',.974,.974,.192,.069,a['tiles'][i],7,coll)

def tube(name,path,coll,queue=False):
 return a['sleeve'](name,path,.20 if not queue else .175,a['glass'] if not queue else a['brass'],coll,inner=.164 if not queue else 0,segments=24)

def make_pipe(coll,kind,queue=False):
 mask=masks[kind];dirs=[v for bit,v in vectors.items() if mask&bit]
 if not queue:tile(coll,kind%4)
 if kind<2:
  before=set(s.objects)
  a['terminal'](525.5,748,kind==0)
  for ob in set(s.objects)-before:
   for c in list(ob.users_collection):c.objects.unlink(ob)
   coll.objects.link(ob)
  tube('Terminal glass',[center+dirs[0]*.26,center+dirs[0]*.52],coll)
 elif len(dirs)==1:
  tube('Closed-end glass',[center,center+dirs[0]*.52],coll,queue)
  a['cyl']('Machined blind cap',center,dirs[0],.217,.10,a['darkbrass'],coll,32,.017)
 elif len(dirs)==2:
  path=[center+dirs[0]*.52,center+dirs[1]*.52] if (dirs[0]+dirs[1]).length<.1 else a['elbow'](center,dirs[0],dirs[1],.31,.52)
  tube('Sight glass',path,coll,queue)
 else:
  for v in dirs:
   # The reference uses an integral brass casting. Overlapping sight glass
   # here refracts the liquid over the metal crown on mobile renderers.
   a['sleeve']('Cast junction neck',[center,center+v*.52],.217,a['brass'],coll,segments=24)
  a['cyl']('Cast junction crown',center+Z*.045,Z,.217,.14,a['brass'],coll,32,.038)
 for v in dirs:
  # Complete unions align at the shared edge; identical adjacent halves overlap.
  a['coupling'](center+v*.5,v,.267,.23,coll)

def build(name,fn,width=1.40):
 coll=a['group']('Fidelity '+name)
 before=set(s.objects);fn(coll)
 obs=list(set(s.objects)-before)
 for ob in obs:ob.hide_render=False
 assets.append((name,coll,obs,width))
 for ob in obs:ob.hide_render=True

for i in range(17):build('p'+str(i),lambda c,i=i:make_pipe(c,i))
for i in range(2,17):build('q'+str(i),lambda c,i=i:make_pipe(c,i,True))
for i in range(4):build('tile'+str(i),lambda c,i=i:tile(c,i))

def wall(c):
 tile(c)
 before=set(s.objects);a['hazard'](525.5,748)
 for ob in set(s.objects)-before:
  for old in list(ob.users_collection):old.objects.unlink(ob)
  c.objects.link(ob)
build('wall',wall)
def deck(c):
 panel('Cast chassis',2,2,.125,.26,a['border'],14,c)
 panel('Recessed black bed',1.91,1.91,.148,.073,a['inset'],10,c)
build('deck',deck,2.1)
def rail(c,vertical):
 direction=Y if vertical else X
 p=Vector((0,0,.117))
 a['sleeve']('Steel return pipe',[p-direction,p+direction],.066,a['edge'],c,segments=16)
 for t in (-.68,0,.68):a['cyl']('Return bracket',p+direction*t,direction,.083,.10,a['border'],c,16,.009)
build('rail0',lambda c:rail(c,False),2.1)
build('rail1',lambda c:rail(c,True),2.1)
def bolt(c):
 a['cyl']('Slotted fastener',(0,0,.17),Z,.062,.045,a['edge'],c,16,.01)
 a['cyl']('Recessed slot',(0,0,.194),X,.008,.087,a['inset'],c,10,.003)
build('bolt',bolt,.22)

def merged(name,obs,mat=None,width=1.4):
 verts=[];faces=[];uvs=[]
 deps=bpy.context.evaluated_depsgraph_get()
 for ob in obs:
  ev=ob.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
  offset=len(verts)
  verts.extend(tuple(ob.matrix_world@v.co) for v in mesh.vertices)
  faces.extend(tuple(offset+i for i in t.vertices) for t in mesh.loop_triangles)
  ev.to_mesh_clear()
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 obj=bpy.data.objects.new(name,data);s.collection.objects.link(obj)
 if mat:data.materials.append(mat)
 for poly in data.polygons:poly.use_smooth=True
 uv=data.uv_layers.new(name='FixedCameraUV')
 for loop in data.loops:
  p=data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x/width+.5,p.y/width+.5)
 return obj

exports=[];manifest=[]
for name,coll,obs,width in assets:
 cam.data.ortho_scale=width
 glass=[o for o in obs if o.type=='MESH' and any(m and m.name.startswith('Sight glass') for m in o.data.materials)]
 opaque=[o for o in obs if o.type=='MESH' and o not in glass]
 for ob in opaque:ob.hide_render=False
 s.render.filepath=str(OUT/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 for ob in obs:ob.hide_render=True
 image=bpy.data.images.load(s.render.filepath);image.pack()
 mat=bpy.data.materials.new('FixedView_'+name);mat.use_nodes=True
 tree=mat.node_tree;tree.nodes.clear()
 tex=tree.nodes.new('ShaderNodeTexImage');tex.image=image
 emission=tree.nodes.new('ShaderNodeEmission');tree.links.new(tex.outputs['Color'],emission.inputs['Color'])
 out=tree.nodes.new('ShaderNodeOutputMaterial');tree.links.new(emission.outputs[0],out.inputs[0])
 obj=merged(name+'_opaque',opaque,mat,width);obj.hide_render=True;exports.append(obj)
 if glass:
  obj=merged(name+'_glass',glass,a['glass'],width);obj.hide_render=True;exports.append(obj)
 manifest.append({'name':name,'opaque_objects':len(opaque),'glass_objects':len(glass),'width':width})
 print('BAKED',name,flush=True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'PipePanic_Modular_Fidelity.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in exports:ob.hide_render=False;ob.select_set(True)
dest=OUT/'pipepanic-modules.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_yup=True)
(OUT/'manifest.json').write_text(json.dumps({'blender':bpy.app.version_string,'method':'Fixed-view Cycles appearance on real mesh geometry; separate realtime glass and cached-water geometry','view':'Filmic / Medium High Contrast / exposure 0','assets':manifest},indent=2),encoding='utf8')
print('FIDELITY_EXPORTED',dest,flush=True)
