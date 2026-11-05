"""Matching reusable UI panels, rendered from the same Blender recipe; no text."""
import bpy,runpy,os
from pathlib import Path
HERE=Path(__file__).resolve().parent
os.environ['PIPEPANIC_EXPORT_ASSETS']='1'
a=runpy.run_path(str(HERE/'rebuild_top_reference.py'))
s=bpy.context.scene
for ob in s.objects:
 if ob.type not in ('CAMERA','LIGHT'):ob.hide_render=True
s.view_settings.view_transform='Filmic';s.view_settings.look='Medium High Contrast';s.view_settings.exposure=0
s.cycles.samples=48;s.render.film_transparent=True;s.render.image_settings.color_mode='RGBA'
try:
 p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='CUDA';p.get_devices()
 for d in p.devices:d.use=d.type=='CUDA'
 s.cycles.device='GPU'
except Exception:pass
out=HERE.parents[1]/'app/src/main/assets/jspp/fidelity-ui';out.mkdir(parents=True,exist_ok=True)
def plate(n,box,z,thick,r,mat,c):return a['plate'](n,box,z,thick,r,mat,c)
def render(name,action=False):
 c=a['group']('UI '+name);before=set(s.objects)
 box=(265.5,683,785.5,813)
 plate('Cast panel',box,.125,.18,20,a['border'],c)
 plate('Machined edge',(269.5,687,781.5,809),.149,.05,18,a['edge'],c)
 plate('Recess',(273.5,691,777.5,805),.151,.04,16,a['inset'],c)
 if action:
  plate('Brass surround',(276.5,694,774.5,802),.181,.04,15,a['bright'],c)
  plate('Blue enamel',(280.5,698,770.5,798),.208,.07,13,a['aqua'],c)
  a['ring_panel']('Luminous glass edge',(284.5,702,766.5,794),1.7,.211,11,a['aqua_line'],c)
 else:
  for x in [283.5,767.5]:
   for y in [701,795]:a['screw'](x,y,.16,.028,c)
 obs=set(s.objects)-before
 s.camera.location=(0,0,15);s.camera.data.ortho_scale=4.08
 s.render.resolution_x=1024;s.render.resolution_y=272
 s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
 for ob in obs:ob.hide_render=True
render('console-panel');render('console-action',True)
print('CONSOLE_UI_DONE',flush=True)
