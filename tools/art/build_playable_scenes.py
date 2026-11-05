"""Create editable Blender scenes for every authored board and representative modes.
Run with the generated modular .blend as input. These are editor references;
the APK composes live state from reusable assets, never these solved boards.
"""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
library=bpy.context.scene
layouts=json.loads((ROOT/'art/fidelity/layouts.json').read_text())
lights=[ob for ob in library.objects if ob.type=='LIGHT']
def place(scene,name,x=0,y=0,sx=1,sy=1):
 for source in bpy.data.collections['Fidelity '+name].objects:
  ob=source.copy();ob.hide_render=False;ob.hide_viewport=False;ob.location+=Vector((x,y,0));ob.scale.x*=sx;ob.scale.y*=sy;scene.collection.objects.link(ob)
for layout in layouts:
 scene=bpy.data.scenes.new(layout['name']);scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
 scene.world=library.world
 scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
 w,h=layout['width'],layout['height']
 scene.render.resolution_x=1051;scene.render.resolution_y=round(1051*(h+.6)/(w+.68));scene.render.resolution_percentage=100
 for source in lights:scene.collection.objects.link(source.copy())
 data=bpy.data.cameras.new(layout['name']+' camera');camera=bpy.data.objects.new('Overhead camera',data);scene.collection.objects.link(camera)
 camera.location=(0,0,15);data.type='ORTHO';data.ortho_scale=w+.68;scene.camera=camera
 place(scene,'deck',sx=(w+.55)/2,sy=(h+.48)/2)
 for row in range(h):
  for col in range(w):
   key=f'{col},{row}';part='wall' if key in layout.get('walls',[]) else 'p'+str(layout['tiles'][key]) if key in layout['tiles'] else 'tile'+str((row+col)%4)
   place(scene,part,col-(w-1)/2,(h-1)/2-row)
 scene['Purpose']='Editable original procedural Blender materials; solved layout reference, not baked level answers used by APK'
 scene['Game layout']=json.dumps(layout)
 print('SCENE',scene.name,flush=True)
bpy.context.window.scene=bpy.data.scenes['puzzle_08']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/fidelity/PipePanic_All_Layouts.blend'))
