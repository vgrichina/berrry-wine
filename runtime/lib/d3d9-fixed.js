// Bounded fixed-function lowering. This compiles actual device state; it is
// never used as a fallback for a guest shader that failed validation.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.D3D9Fixed=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const fail=message=>{throw new Error('D3D9 fixed function: '+message);};
  const rgba=value=>[(value>>>16&255)/255,(value>>>8&255)/255,(value&255)/255,(value>>>24)/255];
  function normalMatrix(world,view){
    // Invert the full world-view matrix, including non-affine terms; D3D
    // consumes the upper 3x3 of its inverse transpose for camera normals.
    const rows=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>
      c<4?[0,1,2,3].reduce((sum,k)=>sum+view[k*4+r]*world[c*4+k],0):+(c-4===r)));
    for(let c=0;c<4;c++){
      let pivot=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c]))pivot=r;
      if(!Number.isFinite(rows[pivot][c])||rows[pivot][c]===0)fail('singular normal transform');
      [rows[c],rows[pivot]]=[rows[pivot],rows[c]];
      const divisor=rows[c][c];for(let k=0;k<8;k++)rows[c][k]/=divisor;
      for(let r=0;r<4;r++)if(r!==c){const scale=rows[r][c];for(let k=0;k<8;k++)rows[r][k]-=scale*rows[c][k];}
    }
    const result=Float32Array.from({length:16},(_,i)=>rows[i>>2][4+(i&3)]);
    if(!result.every(Number.isFinite))fail('nonfinite normal transform');
    return result;
  }
  function compile(draw,viewport,linkedPixel){
    const f=draw.fixedFunction;
    const fixedVS=!draw.vertexShader,fixedPS=!draw.pixelShader;
    if(!f || (!fixedVS&&!fixedPS))fail('missing fixed-function stage');
    if(f.fog&&f.fogTableMode)fail('table/programmed shader fog is not implemented');
    if(f.fog&&!fixedPS&&![0xffff0101,0xffff0102,0xffff0103,0xffff0104].includes(linkedPixel?.version))
      fail('programmed fog profile is not implemented');
    if(f.fog&&!fixedPS&&/varying\s+vec4\s+d3d_color1\s*;/.test(linkedPixel?.source||''))
      fail('programmed fog specular alpha linkage requires conformance');
    if(!fixedPS&&f.specular)fail('programmed pixel post-specular is not implemented');
    const attributes=[],semantics={},values={},vu=[],pu=[];
    const input=(usage,index,required)=>{
      const a=draw.attributes.find(a=>a.usage===usage && a.usageIndex===index);
      if(!a){if(required)fail('missing vertex semantic '+usage+':'+index);return null;}
      const name='d3d_v'+a.register;
      if(!attributes.includes(name)){attributes.push(name);semantics[a.register]={usage,index};}
      return name;
    };
    const transformed=draw.attributes.some(a=>a.usage===9 && a.usageIndex===0);
    const lighting=fixedVS&&f.lighting&&!transformed;
    if(lighting&&f.specular)fail('specular lighting is not implemented');
    if(lighting&&!fixedPS&&/varying\s+vec4\s+d3d_color1\s*;/.test(linkedPixel?.source||''))
      fail('lit secondary-color linkage requires conformance');
    const position=fixedVS?input(transformed?9:0,0,true):null;
    const diffuse=fixedVS?(input(10,0,false)||'vec4(1.0)'):null;
    const specular=fixedVS&&(lighting||f.specular||f.fog||!fixedPS)?(input(10,1,false)||'vec4(0.0)'):'vec4(0.0)';
    const uniform=(stage,name,kind,value)=>{
      (stage==='v'?vu:pu).push(name);values[name]={kind,value};return name;
    };
    const vbody=[],pbody=['vec4 current = ff_diffuse;'],varyings=['varying vec4 ff_diffuse;','varying vec4 ff_specular;'];
    if(f.fog&&!fixedVS){
      uniform('p','d3d_ff_fogColor','4f',new Float32Array(rgba(f.fogColor||0)));
      varyings.push('varying vec4 d3d_fog;');
    }
    let needsNormalize=false;
    const normalized=expression=>{needsNormalize=true;return `d3d_ff_normalize(${expression})`;};
    const transformUV=(uv,stage,index)=>{
      if(!stage.transformFlags||transformed)return uv;
      const matrix=stage.transform;
      if(!(matrix instanceof Float32Array)||matrix.length!==16||!matrix.every(Number.isFinite))fail('invalid texture matrix');
      const name=uniform('v','d3d_ff_texture'+index,'matrix4',matrix);
      // FLOAT2 needs the third row for D3D's documented _31/_32 scrolling.
      const coordinate=draw.attributes.find(a=>a.usage===5&&a.usageIndex===stage.texCoordIndex);
      if(coordinate&&coordinate.type===1)uv=`vec4(${uv}.xy,1.0,${uv}.w)`;
      vbody.push(`vec4 ff_transformed${index} = ${name}*${uv};`);
      return 'ff_transformed'+index;
    };
    const vertexUV=(stage,stageIndex)=>{
      const index=stage.texCoordIndex,generation=index&0xffff0000;
      if(!Number.isInteger(index)||index<0||index>0xffffffff||(index&0xffff)>7)
        fail('invalid texture coordinate index');
      if(!generation)return input(5,index,false)||'vec4(0.0,0.0,0.0,1.0)';
      if(transformed||![0x10000,0x20000,0x30000].includes(generation))
        fail('generated texture coordinates are not implemented for this vertex path');
      if(generation===0x20000){
        vbody.push(`vec4 ff_camera${stageIndex} = vec4((d3d_ff_view*d3d_ff_world*${position}).xyz,1.0);`);
      }else{
        const normal=input(3,0,false)||'vec4(0.0)';
        if(!values.d3d_ff_normal)uniform('v','d3d_ff_normal','matrix4',normalMatrix(f.world,f.view));
        vbody.push(`vec3 ff_normal${stageIndex} = (d3d_ff_normal*vec4(${normal}.xyz,0.0)).xyz;`);
        if(f.normalizeNormals)vbody.push(`ff_normal${stageIndex} = ${normalized('ff_normal'+stageIndex)};`);
        if(generation===0x30000){
          const eye=f.localViewer===false||f.localViewer===0?'vec3(0.0,0.0,1.0)':normalized(`-(d3d_ff_view*d3d_ff_world*${position}).xyz`);
          vbody.push(`vec3 ff_eye${stageIndex} = ${eye};`,
            `ff_normal${stageIndex} = 2.0*dot(ff_eye${stageIndex},ff_normal${stageIndex})*ff_normal${stageIndex}-ff_eye${stageIndex};`);
        }
        vbody.push(`vec4 ff_camera${stageIndex} = vec4(ff_normal${stageIndex},1.0);`);
      }
      return 'ff_camera'+stageIndex;
    };
    if(fixedVS){
    uniform('v','d3d_ff_viewport','4f',new Float32Array([viewport.x,viewport.y,viewport.width,viewport.height]));
    if(transformed){
      uniform('v','d3d_ff_depth','4f',new Float32Array([viewport.minZ,viewport.maxZ-viewport.minZ,0,0]));
      vbody.push(`float q = 1.0 / ${position}.w;`,
        // D3D integer pixel centres sit on GL half-integer centres. The extra
        // -1/16 px (one step of the 4-bit subpixel grid Vulkan/SwiftShader may
        // snap to; 1/128 rounded away) makes D3D's top-left fill rule exact on
        // any GPU: an edge on an integer row/column then owns the centre only
        // as a top/left edge. GL's
        // own tie rule sees D3D's bottom edges as top edges after the y flip, so
        // NFS III's 256-px cockpit tiles both drew row 256 and the upper one's
        // wrapped tv=1.001 sample put a black line across the race view.
        `vec2 screen = (${position}.xy - d3d_ff_viewport.xy + vec2(0.5 - 1.0/16.0)) / d3d_ff_viewport.zw;`,
        `float z = d3d_ff_depth.y == 0.0 ? 0.0 : (${position}.z - d3d_ff_depth.x) / d3d_ff_depth.y;`,
        'gl_Position = vec4(screen.x*2.0-1.0,1.0-screen.y*2.0,z*2.0-1.0,1.0)*q;');
    }else{
      for(const name of ['world','view','projection']){
        const matrix=f[name];
        if(!(matrix instanceof Float32Array) || matrix.length!==16 || !matrix.every(Number.isFinite))fail('invalid '+name+' matrix');
        uniform('v','d3d_ff_'+name,'matrix4',matrix);
      }
      vbody.push(`gl_Position = d3d_ff_projection*d3d_ff_view*d3d_ff_world*${position};`,
        'gl_Position.z = gl_Position.z*2.0-gl_Position.w;',
        // D3D9 integer pixel centers correspond to GL half-integer centers;
        // less 1/16 px for the top-left fill rule, as for pretransformed vertices.
        'gl_Position.xy += vec2(1.0,-1.0)*(1.0-2.0/16.0)*gl_Position.w/d3d_ff_viewport.zw;');
    }
    vbody.push(`ff_diffuse = clamp(${diffuse},0.0,1.0);`,`ff_specular = clamp(${specular},0.0,1.0);`);
    if(lighting){
      const material=f.material,lights=f.lights||[];
      if(!material||!Array.isArray(lights)||lights.length>8)fail('invalid lighting state');
      const color=(value,label)=>{if(!(value instanceof Float32Array)||value.length!==4||!value.every(Number.isFinite))fail('invalid '+label);return value;};
      const materialSource=(name,state,defaultSource)=>{
        const source=f[state]??defaultSource;if(![0,1,2].includes(source))fail('invalid material source');
        const fallback=uniform('v','d3d_ff_material_'+name,'4f',color(material[name],'material '+name));
        if(f.colorVertex===false||f.colorVertex===0)return fallback;
        return source===1?(input(10,0,false)||fallback):source===2?(input(10,1,false)||fallback):fallback;
      };
      const md=materialSource('diffuse','diffuseMaterialSource',1),ma=materialSource('ambient','ambientMaterialSource',0),me=materialSource('emissive','emissiveMaterialSource',0);
      // A declaration with no NORMAL element reads it as zero on D3D9: the
      // light's diffuse/specular terms vanish and ambient+emissive remain.
      const normal=input(3,0,false)||'vec4(0.0)';
      if(!values.d3d_ff_normal)uniform('v','d3d_ff_normal','matrix4',normalMatrix(f.world,f.view));
      vbody.push(`vec3 ff_litNormal = (d3d_ff_normal*vec4(${normal}.xyz,0.0)).xyz;`);
      if(f.normalizeNormals)vbody.push(`ff_litNormal = ${normalized('ff_litNormal')};`);
      if(lights.some(light=>light.type!==3))
        vbody.push(`vec3 ff_litPosition = (d3d_ff_view*d3d_ff_world*${position}).xyz;`);
      const ambient=uniform('v','d3d_ff_globalAmbient','4f',new Float32Array(rgba(f.ambientColor||0)));
      vbody.push(`vec3 ff_lightAmbient = ${ambient}.rgb;`,'vec3 ff_lightDiffuse = vec3(0.0);');
      lights.forEach((light,i)=>{
        if(![1,2,3].includes(light.type))fail('invalid light type');
        const ld=uniform('v','d3d_ff_lightDiffuse'+i,'4f',color(light.diffuse,'light diffuse'));
        const la=uniform('v','d3d_ff_lightAmbient'+i,'4f',color(light.ambient,'light ambient'));
        let factor='1.0';
        if(light.type===3){
          if(!(light.direction instanceof Float32Array)||light.direction.length!==3||!light.direction.every(Number.isFinite))fail('invalid light direction');
          const direction=uniform('v','d3d_ff_lightDirection'+i,'4f',new Float32Array([...light.direction,0]));
          vbody.push(`vec3 ff_lightVector${i} = -${normalized(`(d3d_ff_view*${direction}).xyz`)};`);
        }else{
          if(!(light.position instanceof Float32Array)||light.position.length!==3||!light.position.every(Number.isFinite))fail('invalid light position');
          const attenuation=[light.range,light.attenuation0,light.attenuation1,light.attenuation2];
          if(!attenuation.every(Number.isFinite)||light.range<=0||attenuation.slice(1).some(value=>value<0)||
              attenuation.slice(1).every(value=>value===0))fail('invalid light attenuation');
          const position=uniform('v','d3d_ff_lightPosition'+i,'4f',new Float32Array([...light.position,1]));
          const atten=uniform('v','d3d_ff_lightAttenuation'+i,'4f',new Float32Array(attenuation));
          vbody.push(`vec3 ff_lightDelta${i} = (d3d_ff_view*${position}).xyz-ff_litPosition;`,
            `float ff_lightDistance${i} = length(ff_lightDelta${i});`,
            `vec3 ff_lightVector${i} = ff_lightDelta${i}/max(ff_lightDistance${i},1.0e-20);`,
            `float ff_lightFactor${i} = ff_lightDistance${i} <= ${atten}.x ? 1.0/max(${atten}.y+${atten}.z*ff_lightDistance${i}+${atten}.w*ff_lightDistance${i}*ff_lightDistance${i},1.0e-20) : 0.0;`);
          factor=`ff_lightFactor${i}`;
          if(light.type===2){
            if(!(light.direction instanceof Float32Array)||light.direction.length!==3||!light.direction.every(Number.isFinite)||
                ![light.falloff,light.theta,light.phi].every(Number.isFinite)||light.falloff<0||
                light.theta<0||light.theta>light.phi||light.phi>Math.PI)fail('invalid spot light cone');
            const direction=uniform('v','d3d_ff_lightDirection'+i,'4f',new Float32Array([...light.direction,0]));
            const cone=uniform('v','d3d_ff_lightCone'+i,'4f',new Float32Array([
              Math.cos(light.theta*.5),Math.cos(light.phi*.5),light.falloff,0]));
            vbody.push(`float ff_lightRho${i} = dot(-ff_lightVector${i},${normalized(`(d3d_ff_view*${direction}).xyz`)});`,
              `float ff_lightSpot${i} = ff_lightRho${i} >= ${cone}.x ? 1.0 : (ff_lightRho${i} <= ${cone}.y ? 0.0 : pow((ff_lightRho${i}-${cone}.y)/max(${cone}.x-${cone}.y,1.0e-7),${cone}.z));`);
            factor=`(${factor}*ff_lightSpot${i})`;
          }
        }
        vbody.push(`ff_lightDiffuse += ${ld}.rgb*max(dot(ff_litNormal,ff_lightVector${i}),0.0)*${factor};`,
          `ff_lightAmbient += ${la}.rgb*${factor};`);
      });
      vbody.push(`ff_diffuse = clamp(vec4(${me}.rgb+${ma}.rgb*ff_lightAmbient+${md}.rgb*ff_lightDiffuse,${md}.a),0.0,1.0);`);
      // COLOR2 remains available above as a material source and below as a
      // supplied fog factor; it is not an implemented lit specular output.
      vbody.push('ff_specular = vec4(0.0);');
    }
    if(f.fog){
      const mode=transformed?0:(f.fogVertexMode||0);
      if(![0,1,2,3].includes(mode))fail('invalid vertex fog mode');
      uniform('p','d3d_ff_fogColor','4f',new Float32Array(rgba(f.fogColor||0)));
      varyings.push('varying float ff_fog;');
      if(!mode)vbody.push(`ff_fog = clamp(${specular}.a,0.0,1.0);`);
      else{
        const start=f.fogStart??0,end=f.fogEnd??1,density=f.fogDensity??1;
        if(mode===3?(!Number.isFinite(start)||!Number.isFinite(end)||start===end):!Number.isFinite(density))
          fail('invalid vertex fog parameters');
        uniform('v','d3d_ff_fogParams','4f',new Float32Array([start,end,density,0]));
        vbody.push(`vec3 ff_fogPosition = (d3d_ff_view*d3d_ff_world*${position}).xyz;`,
          `float ff_fogDistance = ${f.rangeFog?'length(ff_fogPosition)':'abs(ff_fogPosition.z)'};`);
        const amount=mode===3?'(d3d_ff_fogParams.y-ff_fogDistance)/(d3d_ff_fogParams.y-d3d_ff_fogParams.x)':
          mode===1?'exp(-d3d_ff_fogParams.z*ff_fogDistance)':
          'exp(-(d3d_ff_fogParams.z*ff_fogDistance)*(d3d_ff_fogParams.z*ff_fogDistance))';
        vbody.push(`ff_fog = clamp(${amount},0.0,1.0);`);
      }
    }
    if(draw.state?.fillMode===1&&draw.attributes.some(a=>a.usage===4&&a.usageIndex===0)){
      const size=draw.attributes.filter(a=>a.usage===4&&a.usageIndex===0);
      if(size.length!==1||size[0].type!==0)fail('PSIZE requires one FLOAT1 input');
      vbody.push(`gl_PointSize = ${input(4,0,true)}.x;`);
    }
    }
    if(fixedPS){
    pbody.push('vec4 temporary = vec4(0.0);');
    let lastResult=1;
    if(!f.stages?.[0])fail('missing texture stage state');
    for(let stageIndex=0;stageIndex<f.stages.length;stageIndex++){
    const stage=f.stages[stageIndex];
    if(!stage)fail('missing texture stage state');
    // D3D9 terminates the cascade when COLORARG1 is TEXTURE but no
    // texture is bound (MSDN Texture Blending), even without COLOROP_DISABLE.
    const disabled=stage.colorOp===1 || (stage.colorArg1===2 && !draw.textures?.[stageIndex]);
    if(disabled)break;
    if(stageIndex>=6)fail('texture stages beyond the six-stage resource contract');
    const result=stage.resultArg??1;
    if(result!==1&&result!==5)fail('invalid result argument');
    lastResult=result;
    {
      const textureFlags=stage.transformFlags||0,textureCount=textureFlags&255,projected=!!(textureFlags&256);
      if(textureFlags&&(!fixedVS||![2,3,4,259,260].includes(textureFlags)))fail('unsupported texture transform flags');
      const coordinateIndex=stage.texCoordIndex,coordinateGeneration=coordinateIndex&0xffff0000;
      if(!Number.isInteger(coordinateIndex)||coordinateIndex<0||coordinateIndex>0xffffffff||(coordinateIndex&0xffff)>7)
        fail('invalid texture coordinate index');
      if(coordinateGeneration&&(![0x10000,0x20000,0x30000].includes(coordinateGeneration)||!fixedVS||transformed))
        fail('generated texture coordinates are not implemented for this vertex path');
      let sampled=false;
      const previous=stageIndex?f.stages[stageIndex-1]:null;
      const premultiplyColor=previous?.colorOp===17,premultiplyAlpha=previous?.alphaOp===17;
      const bump=stage.colorOp===22||stage.colorOp===23;
      const previousBump=previous?.colorOp===22||previous?.colorOp===23;
      if(bump){
        if(!draw.textures?.[stageIndex]||draw.textures[stageIndex].format!==62||draw.textures[stageIndex].faces)
          fail('fixed bump requires a signed 2D bump texture');
        const values=draw.bumpStates?.[stageIndex];
        if(!values||values.length!==6||!Array.from(values).every(Number.isFinite))fail('invalid fixed bump metadata');
        uniform('p','d3d_ff_bump'+stageIndex,'4f',Float32Array.from(values.slice(0,4)));
        uniform('p','d3d_ff_bumpL'+stageIndex,'4f',new Float32Array([values[4],values[5],0,0]));
        sampled=true;
      }
      const arg=value=>{
        if(value&~63)fail('texture argument flags');
        const base=value&15;
        let expression;
        if(base===0)expression='ff_diffuse';
        else if(base===1){
          expression='current';
          if((premultiplyColor||premultiplyAlpha)&&draw.textures?.[stageIndex]){
            sampled=true;
            expression=`(current*vec4(${premultiplyColor?'sample'+stageIndex+'.rgb':'vec3(1.0)'},${premultiplyAlpha?'sample'+stageIndex+'.a':'1.0'}))`;
          }
        }
        else if(base===2){
          if(!draw.textures || !draw.textures[stageIndex])fail('missing texture'+stageIndex);
          sampled=true;expression='sample'+stageIndex;
        }else if(base===3)expression=uniform('p','d3d_ff_factor','4f',new Float32Array(rgba(f.textureFactor)));
        else if(base===4)expression='ff_specular';
        else if(base===5)expression='temporary';
        else if(base===6)expression=uniform('p','d3d_ff_constant'+stageIndex,'4f',new Float32Array(rgba(stage.constant)));
        else fail('texture argument '+base);
        if(value&32)expression='vec4(('+expression+').a)';
        if(value&16)expression='(vec4(1.0)-'+expression+')';
        return expression;
      };
      const op=(mode,a,b,alpha=false,c=1)=>{
        if(mode===22||mode===23){
          if(alpha)fail('color-only texture operation used for alpha');
          return 'current';
        }
        if(mode===2||mode===17)return arg(a);
        if(mode===3)return arg(b);
        if(![4,5,6,7,8,9,10,11,12,13,14,15,16,18,19,20,21,24,25,26].includes(mode))fail('texture operation '+mode);
        if(alpha&&mode>=18&&mode<=21)fail('color-only texture operation used for alpha');
        const x=arg(a),y=arg(b);
        // DOT3 consumes signed RGB inputs even for ALPHAOP. The caller's
        // separate RGB/alpha assignment applies the requested output mask.
        if(mode===24)return `vec4(dot(2.0*(${x}).rgb-vec3(1.0),2.0*(${y}).rgb-vec3(1.0)))`;
        if(mode===25||mode===26){
          const z=arg(c);
          return mode===25?`(${z}+${x}*${y})`:`(${z}*${x}+(vec4(1.0)-${z})*${y})`;
        }
        if(mode>=18){
          const xa=`vec4((${x}).a)`;
          return ({18:`(${x}+${xa}*${y})`,19:`(${x}*${y}+${xa})`,
            20:`(${x}+(vec4(1.0)-${xa})*${y})`,21:`((vec4(1.0)-${x})*${y}+${xa})`})[mode];
        }
        if(mode>=12){
          // These factors are pipeline inputs, independent of COLORARG1/2
          // and their modifiers. Color and alpha both read pre-stage CURRENT.
          const factor=mode===12?'ff_diffuse.a':mode===16?'current.a':
            mode===14?`(${arg(3)}).a`:`(${arg(2)}).a`;
          return mode===15?`(${x}+${y}*(1.0-${factor}))`:
            `(${x}*${factor}+${y}*(1.0-${factor}))`;
        }
        return ({4:`(${x}*${y})`,5:`(2.0*${x}*${y})`,6:`(4.0*${x}*${y})`,
          7:`(${x}+${y})`,8:`(${x}+${y}-vec4(0.5))`,9:`(2.0*(${x}+${y}-vec4(0.5)))`,
          10:`(${x}-${y})`,11:`(${x}+${y}-${x}*${y})`})[mode];
      };
      const color=op(stage.colorOp,stage.colorArg1,stage.colorArg2,false,stage.colorArg0??1);
      const alpha=stage.alphaOp===1?'current':op(stage.alphaOp,stage.alphaArg1,stage.alphaArg2,true,stage.alphaArg0??1);
      if(sampled){
        if(!fixedVS&&stage.texCoordIndex!==stageIndex)fail('programmable VS requires default texture coordinate index');
        let uv=fixedVS?vertexUV(stage,stageIndex):null;
        const varying=stageIndex?'ff_uv'+stageIndex:'ff_uv';
        const cube=!!draw.textures[stageIndex].faces,components=cube?'xyz':'xy';
        if(projected&&cube)fail('projected cube coordinates are not implemented');
        if(fixedVS)uv=transformUV(uv,stage,stageIndex);
        if(cube&&textureFlags&&textureCount<3)fail('cube transform needs three coordinates');
        varyings.push(`varying vec${projected?4:cube?3:2} ${varying};`);
        if(fixedVS)vbody.push(`${varying} = ${projected?uv:uv+'.'+components};`);
        if(projected){
          // Preserve nonfinite-input information before the varying hardware
          // can clamp infinities to finite endpoints during interpolation.
          varyings.push(`varying float ff_projectInput${stageIndex};`);
          vbody.push(`ff_projectInput${stageIndex} = all(lessThanEqual(abs(${uv}),vec4(3.402823466e38))) ? 1.0 : 0.0;`,
            `if (ff_projectInput${stageIndex} == 0.0) ${varying} = vec4(0.0);`);
        }
        let coordinates=projected?`(${varying}.xy / ${varying}.${textureCount===3?'z':'w'})`:varying;
        if(projected){
          const n=stageIndex,q=`${varying}.${textureCount===3?'z':'w'}`;
          // Defined emulator policy for invalid projected coordinates. Keep the
          // sample outside divergent control flow and sanitize its helper UVs.
          pbody.push(`bool ff_valid${n} = ff_projectInput${n} >= 1.0 && abs(${q}) > 0.0 && abs(${q}) <= 3.402823466e38;`,
            `vec2 ff_projected${n} = ${varying}.xy / (ff_valid${n} ? ${q} : 1.0);`,
            `ff_valid${n} = ff_valid${n} && all(lessThanEqual(abs(ff_projected${n}),vec2(3.402823466e38)));`,
            `ff_projected${n} = ff_valid${n} ? ff_projected${n} : vec2(0.0);`);
          coordinates='ff_projected'+n;
        }
        if(previousBump){
          if(projected||cube)fail('projected/cube fixed bump coordinates are not implemented');
          const n=stageIndex-1;
          coordinates=`(${coordinates}+vec2(dot(d3d_ff_bump${n}.xz,sample${n}.xy),dot(d3d_ff_bump${n}.yw,sample${n}.xy)))`;
        }
        pu.push('d3d_s'+stageIndex);pbody.push(`vec4 sample${stageIndex} = ${cube?'textureCube':'texture2D'}(d3d_s${stageIndex},${coordinates});`);
        if(projected)pbody.push(`if (!ff_valid${stageIndex}) sample${stageIndex} = vec4(0.0);`);
        // DirectDraw source colour key (D3DIM COLORKEYENABLE): the host marks
        // keyed texels with alpha 0 and the texel is never written, as in D3D5-7.
        if(f.colorKey&&stageIndex===0)pbody.push('if (sample0.a < 0.5) discard;');
        if(previous?.colorOp===23){
          const n=stageIndex-1;
          pbody.push(`sample${stageIndex}.rgb *= clamp(sample${n}.z*d3d_ff_bumpL${n}.x+d3d_ff_bumpL${n}.y,0.0,1.0);`);
        }
      }
      pbody.push(`${result===5?'temporary':'current'} = clamp(vec4((${color}).rgb,(${alpha}).a),0.0,1.0);`);
    }
    }
    if(lastResult!==1)fail('last active texture stage must write CURRENT');
    if(f.specular)pbody.push('current.rgb = clamp(current.rgb+ff_specular.rgb,0.0,1.0);');
    if(f.alphaTest){
      const compare=['','false','current.a < d3d_ff_alpha.x','current.a == d3d_ff_alpha.x',
        'current.a <= d3d_ff_alpha.x','current.a > d3d_ff_alpha.x','current.a != d3d_ff_alpha.x',
        'current.a >= d3d_ff_alpha.x','true'][f.alphaFunc];
      if(!compare)fail('alpha comparison');
      uniform('p','d3d_ff_alpha','4f',new Float32Array([(f.alphaRef&255)/255,0,0,0]));
      pbody.push(`if (!(${compare})) discard;`);
    }
    if(f.fog)pbody.push(`current.rgb = mix(d3d_ff_fogColor.rgb,current.rgb,clamp(${fixedVS?'ff_fog':'d3d_fog.x'},0.0,1.0));`);
    pbody.push('gl_FragColor = current;');
    }else{
      if(!linkedPixel)fail('missing programmed pixel linkage');
      const names=new Set(Array.from(linkedPixel.source.matchAll(/varying\s+vec4\s+(d3d_(?:color[01]|tex[0-5]))\s*;/g),m=>m[1]));
      for(const name of names){
        let value;
        if(name==='d3d_color0')value='ff_diffuse';
        else if(name==='d3d_color1')value=`clamp(${specular},0.0,1.0)`;
        else{
          const index=Number(name.slice(-1)),state=f.stages[index];
          if(!state||![0,2,3,4,259,260].includes(state.transformFlags||0))
            fail('unsupported fixed vertex texture coordinates');
          value=vertexUV(state,index);
          value=transformUV(value,state,index);
          if(state.transformFlags===2)value=`vec4(${value}.xy,0.0,1.0)`;
          if(state.transformFlags===3)value=`vec4(${value}.xyz,1.0)`;
          if(state.transformFlags&256){
            varyings.push(`varying float ff_projectInput${index};`);
            vbody.push(`ff_projectInput${index} = all(lessThanEqual(abs(${value}),vec4(3.402823466e38))) ? 1.0 : 0.0;`);
            value=`(ff_projectInput${index} == 0.0 ? vec4(0.0) : ${value})`;
          }
        }
        varyings.push(`varying vec4 ${name};`);vbody.push(`${name} = ${value};`);
      }
    }
    const source=(stage,uniforms,body)=>{
      const lines=['precision highp float;',...varyings];
      if(stage==='v'&&needsNormalize)lines.push(
        // Explicit emulator policy: degenerate/nonfinite squared length is zero.
        'vec3 d3d_ff_normalize(vec3 v) { float d = dot(v,v);',
        'return d > 0.0 && d <= 3.402823466e38 ? v*inversesqrt(d) : vec3(0.0); }');
      if(stage==='v')for(const name of attributes)lines.push('attribute vec4 '+name+';');
      for(const name of new Set(uniforms))lines.push('uniform '+(/^d3d_s\d+$/.test(name)?
        (draw.textures[Number(name.slice(5))]?.faces?'samplerCube':'sampler2D'):values[name].kind==='matrix4'?'mat4':'vec4')+' '+name+';');
      let result=lines.join('\n')+'\nvoid main(){\n'+body.join('\n')+'\n}';
      if(stage==='p'&&!fixedVS)result=result.replace(/varying vec[23] ff_uv([1-5]?);/g,(_,index)=>`varying vec4 d3d_tex${index||0};`)
        .replace(/\bff_uv([1-5]?)\b/g,(_,index)=>`d3d_tex${index||0}.${draw.textures[Number(index||0)]?.faces?'xyz':'xy'}`)
        .replace(/\bff_diffuse\b/g,'d3d_color0').replace(/\bff_specular\b/g,'d3d_color1');
      return result;
    };
    return {values,vertex:fixedVS?{stage:'vertex',source:source('v',vu,vbody),attributes,semantics,uniforms:[...new Set(vu)]}:null,
      pixel:fixedPS?{stage:'pixel',source:source('p',pu,pbody),uniforms:[...new Set(pu)]}:null};
  }
  // Cache the bridge's small POSITIONT pipeline, never mutable draw snapshots.
  // Matrices, lighting, generated coordinates and mixed shader linkage retain
  // the full compiler and its validation on every draw.
  const tlFields=new Set(['lighting','fog','fogColor','specular','alphaTest','alphaFunc','alphaRef',
    'textureFactor','colorKey','stages']);
  const stageFields=new Set(['colorOp','colorArg1','colorArg2','alphaOp','alphaArg1','alphaArg2',
    'constant','transformFlags','texCoordIndex']);
  const tlDeclaration=[[0,9,0,3,0],[5,10,0,4,16],[7,5,0,1,24],[6,10,1,4,20]];
  function tlKey(draw){
    const f=draw.fixedFunction,a=draw.attributes,stages=f?.stages,s=stages?.[0];
    if(draw.vertexShader||draw.pixelShader||!f||f.lighting||f.specular||
        Object.keys(f).some(k=>!tlFields.has(k))||
        (draw.state?.fillMode??3)!==3||!Array.isArray(a)||![3,4].includes(a.length)||
        !Array.isArray(stages)||stages.length!==2||!s||stages[1]?.colorOp!==1||
        Object.keys(stages[1]).some(k=>k!=='colorOp')||
        Object.keys(s).some(k=>!stageFields.has(k))||s.transformFlags!==0||s.texCoordIndex!==0||
        ![2,3,4].includes(s.colorOp)||![1,2,3,4].includes(s.alphaOp)||
        ![s.colorArg1,s.colorArg2,s.alphaArg1,s.alphaArg2].every(v=>v===0||v===2)||
        ![f.fogColor,f.alphaFunc,f.alphaRef,f.textureFactor,s.constant].every(Number.isInteger)||
        ![f.fog,f.alphaTest,f.colorKey].every(v=>[false,true,0,1].includes(v))||
        !Array.isArray(draw.textures)||draw.textures.length>1||draw.textures[0]?.faces)
      return null;
    const fields=['register','usage','usageIndex','type','offset'];
    for(let i=0;i<a.length;i++)
      if(!a[i]||fields.some((k,j)=>a[i][k]!==tlDeclaration[i][j]))return null;
    return [a.length,+f.fog,+f.alphaTest,f.alphaFunc,+f.colorKey,!!draw.textures[0],
      s.colorOp,s.colorArg1,s.colorArg2,s.alphaOp,s.alphaArg1,s.alphaArg2].join(',');
  }
  class TLCache {
    constructor(limit=64){
      if(!Number.isInteger(limit)||limit<1||limit>256)fail('invalid fixed plan cache limit');
      this.limit=limit;this.plans=new Map();
    }
    compile(draw,viewport,linkedPixel){
      const key=tlKey(draw);
      if(key===null||linkedPixel)return compile(draw,viewport,linkedPixel);
      let plan=this.plans.get(key);
      if(!plan){
        plan=compile(draw,viewport,linkedPixel);
        if(this.plans.size===this.limit)this.plans.delete(this.plans.keys().next().value);
        this.plans.set(key,{vertex:plan.vertex,pixel:plan.pixel});
      }
      const f=draw.fixedFunction;
      const values={
        d3d_ff_viewport:{kind:'4f',value:new Float32Array([viewport.x,viewport.y,viewport.width,viewport.height])},
        d3d_ff_depth:{kind:'4f',value:new Float32Array([viewport.minZ,viewport.maxZ-viewport.minZ,0,0])},
      };
      if(f.fog)values.d3d_ff_fogColor={kind:'4f',value:new Float32Array(rgba(f.fogColor))};
      if(f.alphaTest)values.d3d_ff_alpha={kind:'4f',value:new Float32Array([(f.alphaRef&255)/255,0,0,0])};
      return {vertex:plan.vertex,pixel:plan.pixel,values};
    }
    clear(){this.plans.clear();}
  }
  return {compile,TLCache};
});
