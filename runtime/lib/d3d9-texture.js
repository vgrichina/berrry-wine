// Immutable D3D9 block-compressed texture snapshots. Guest storage stays DXT;
// decoding is an upload conversion, never an edit of the authoritative bytes.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.D3D9Texture=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DXT1=0x31545844,DXT3=0x33545844,DXT5=0x35545844;
  const color565=c=>{
    const r=c>>>11,g=(c>>>5)&63,b=c&31;
    return [(r<<3)|(r>>>2),(g<<2)|(g>>>4),(b<<3)|(b>>>2),255];
  };
  function decode(bytes,width,height,format){
    if(![DXT1,DXT3,DXT5].includes(format))throw new Error('unsupported DXT format');
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)
      throw new Error('invalid DXT dimensions');
    const blockBytes=format===DXT1?8:16,columns=Math.ceil(width/4),rows=Math.ceil(height/4);
    if(!(bytes instanceof Uint8Array)||bytes.length!==columns*rows*blockBytes)
      throw new Error('invalid DXT byte length');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),pixels=new Uint8Array(width*height*4);
    for(let by=0;by<rows;by++)for(let bx=0;bx<columns;bx++){
      const start=(by*columns+bx)*blockBytes,c=start+(format===DXT1?0:8);
      const c0=view.getUint16(c,true),c1=view.getUint16(c+2,true),colors=[color565(c0),color565(c1)];
      // Only DXT1 spends the c0<=c1 ordering on a 1-bit alpha mode; the explicit-
      // alpha formats always interpolate all four colours.
      if(c0>c1||format!==DXT1){
        colors.push(colors[0].map((v,i)=>i===3?255:Math.floor((2*v+colors[1][i]+1)/3)));
        colors.push(colors[0].map((v,i)=>i===3?255:Math.floor((v+2*colors[1][i]+1)/3)));
      }else{
        colors.push(colors[0].map((v,i)=>i===3?255:Math.floor((v+colors[1][i])/2)));
        colors.push([0,0,0,0]);
      }
      const alpha=[];
      if(format===DXT5){
        alpha.push(bytes[start],bytes[start+1]);
        const steps=alpha[0]>alpha[1]?7:5;
        for(let i=1;i<steps;i++)alpha.push(Math.floor(((steps-i)*alpha[0]+i*alpha[1]+(steps>>>1))/steps));
        if(steps===5)alpha.push(0,255);
      }
      const indices=view.getUint32(c+4,true);
      for(let i=0;i<16;i++){
        const x=bx*4+(i&3),y=by*4+(i>>>2);if(x>=width||y>=height)continue;
        const p=(y*width+x)*4,rgba=colors[(indices>>>(i*2))&3];
        pixels.set(rgba,p);
        if(format===DXT5){
          // The 48-bit little-endian alpha selector spans byte boundaries.
          const bit=i*3,offset=start+2+(bit>>>3),shift=bit&7;
          const selector=(bytes[offset]|((offset<start+7?bytes[offset+1]:0)<<8))>>>shift&7;
          pixels[p+3]=alpha[selector];
        }else if(format===DXT3){
          // Sixteen explicit 4-bit alphas, low nibble first, replicated to 8 bits
          // so 0xf becomes 0xff rather than 0xf0.
          const nibble=(bytes[start+(i>>>1)]>>>((i&1)*4))&15;
          pixels[p+3]=(nibble<<4)|nibble;
        }
      }
    }
    return pixels;
  }
  return {decode,DXT1,DXT3,DXT5};
});
