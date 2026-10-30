tux_course_light 0 -on -position { 1 1 0 0 } -diffuse { 0.39 0.51 0.88 1 } \
     -specular { 0.0 0.0 0.0 1 } -ambient { 0.0 0.09 0.34 1.0 }
     
tux_course_light 1 -on -position { 1 1 1 0 } -specular { 0.8 0.8 0.8 1 } 

tux_fog -on -mode linear -density 0.005 -colour { 0.0 0.09 0.34 1 } -start 0 \
    -end [tux_get_param forward_clip_distance]

  
#
# Environmental sphere map
    
tux_load_texture alpine1-sphere ../common/nightenv.rgb 0
tux_bind_texture terrain_envmap alpine1-sphere

tux_particle_colour { 0.39 0.51 0.88 1.0 }

tux_load_texture alpine1-front ../common/nightfront.rgb 0
tux_load_texture alpine1-right ../common/nightright.rgb 0
tux_load_texture alpine1-left ../common/nightleft.rgb 0
tux_load_texture alpine1-back ../common/nightback.rgb 0
tux_load_texture alpine1-top ../common/nighttop.rgb 0
tux_load_texture alpine1-bottom ../common/nightbottom.rgb 0

tux_bind_texture sky_front alpine1-front
tux_bind_texture sky_right alpine1-right
tux_bind_texture sky_left alpine1-left
tux_bind_texture sky_back alpine1-back
tux_bind_texture sky_top alpine1-top
tux_bind_texture sky_bottom alpine1-bottom