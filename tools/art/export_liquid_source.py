"""Export evaluated, already baked Mantaflow mesh frames for local playback."""
import bpy,json,struct,gzip
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art'/'source-water'/'samples'
OUT.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene
ob=bpy.data.objects['Liquid simulation · Blender Mantaflow']
settings=next(m.domain_settings for m in ob.modifiers if m.type=='FLUID')
settings.cache_directory=str(Path(bpy.data.filepath).parent/'flow_cache')
frames=[]
for frame in range(1,105,2):
 s.frame_set(frame)
 dep=bpy.context.evaluated_depsgraph_get()
 ev=ob.evaluated_get(dep)
 mesh=ev.to_mesh();mesh.calc_loop_triangles()
 count=len(mesh.vertices)
 p=np.empty(count*3,dtype=np.float32);mesh.vertices.foreach_get('co',p);p=p.reshape((-1,3))
 n=np.empty(count*3,dtype=np.float32);mesh.vertices.foreach_get('normal',n);n=n.reshape((-1,3))
 transform=np.array(ob.matrix_world,dtype=np.float32)
 p=p@transform[:3,:3].T+transform[:3,3]
 normal_matrix=np.linalg.inv(transform[:3,:3]).T
 n=n@normal_matrix.T;n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
 p=p[:,[0,2,1]];p[:,2]*=-1
 n=n[:,[0,2,1]];n[:,2]*=-1
 idx=np.empty(len(mesh.loop_triangles)*3,dtype=np.uint32);mesh.loop_triangles.foreach_get('vertices',idx)
 payload=struct.pack('<4sII',b'WTR1',count,len(mesh.loop_triangles))+p.astype('<f4').tobytes()+n.astype('<f4').tobytes()+idx.astype('<u4').tobytes()
 name=f'water-{frame:03}.wtr'
 raw=gzip.compress(payload,compresslevel=6,mtime=0);(OUT/name).write_bytes(raw)
 frames.append({'frame':frame,'file':name,'vertices':count,'triangles':len(mesh.loop_triangles),'bytes':len(raw)})
 ev.to_mesh_clear()
 print('WATER',frame,count,len(raw),flush=True)
(OUT/'frames.json').write_text(json.dumps({'fps':24,'step':2,'method':'Baked Blender Mantaflow geometry playback, not a realtime fluid solver','frames':frames},indent=2),encoding='utf-8')
print('WATER_DONE',sum(f['bytes'] for f in frames),flush=True)
