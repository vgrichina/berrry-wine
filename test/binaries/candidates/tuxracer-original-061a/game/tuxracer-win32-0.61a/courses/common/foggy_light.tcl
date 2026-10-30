tux_course_light 0 -on -position { 1 1 1 0 } -diffuse { 0.45 0.43 0.47 1 } \
     -specular { 0.3 0.3 0.3 1 } -ambient { 0.39 0.4 0.44 1.0 }

tux_course_light 1 -on -position { 1 1 2 0 } -specular { 0.5 0.5 0.5 1 } 

set fog_dist 40
set far_clip [tux_get_param forward_clip_distance]
if { $fog_dist > $far_clip } {
    set fog_dist $far_clip
} 

tux_fog -on -mode linear -start -10 -end $fog_dist -colour { 0.58 0.59 0.65 1.0 }

tux_particle_colour { 0.36 0.41 0.49 1.0 }
  
    
tux_load_texture envmap ../common/envmap.rgb 0
tux_bind_texture terrain_envmap envmap


tux_load_texture alpine1-front ../common/cloudyfront.rgb 0
tux_load_texture alpine1-right ../common/cloudyright.rgb 0
tux_load_texture alpine1-left ../common/cloudyleft.rgb 0
tux_load_texture alpine1-back ../common/cloudyback.rgb 0
tux_load_texture alpine1-top ../common/cloudytop.rgb 0
tux_load_texture alpine1-bottom ../common/cloudybottom.rgb 0

tux_bind_texture sky_front alpine1-front
tux_bind_texture sky_right alpine1-right
tux_bind_texture sky_left alpine1-left
tux_bind_texture sky_back alpine1-back
tux_bind_texture sky_top alpine1-top
tux_bind_texture sky_bottom alpine1-bottom
