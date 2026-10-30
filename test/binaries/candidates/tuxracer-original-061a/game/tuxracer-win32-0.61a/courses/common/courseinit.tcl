#Course initialization script
#sets basic course paramaters before the lighting is set.

set cwd [pwd]
tux_goto_data_dir
cd courses/common

source tree_polyhedron.tcl

tux_load_texture fish herring_standard.rgb 0
tux_item_spec -name herring -diameter 1.0 -height 1.0 \
      -texture fish -colour {28 185 204} -above_ground 0.2

tux_load_texture shrub shrub.rgb 0
tux_tree_props -name tree3 -diameter 1.4 -height 1.0 \
      -texture shrub -colour {0 255 48} -polyhedron $tree_poly \
      -size_varies 0.5 

tux_load_texture tree tree.rgb 0
tux_tree_props -name tree1 -diameter 1.4 -height 2.5 \
      -texture tree -colour {255 255 255} -polyhedron $tree_poly \
      -size_varies 0.5 

tux_load_texture tree_barren tree_barren.rgb 0
tux_tree_props -name tree2 -diameter 1.4 -height 2.5 \
      -texture tree_barren -colour {255 96 0} -polyhedron $tree_poly \
      -size_varies 0.5 

#tux_load_texture finish_f f.rgb 0
#tux_tree_props -name tree4 -diameter 2.0 -height 2.0 \
#      -texture finish_f -colour {255 0 253} -polyhedron $tree_poly \
#      -size_varies 0.0 

#tux_load_texture finish_i i.rgb 0
#tux_tree_props -name tree5 -diameter 2.0 -height 2.0 \
#      -texture finish_i -colour {255 56 253} -polyhedron $tree_poly \
#      -size_varies 0.0 

#tux_load_texture finish_n n.rgb 0
#tux_tree_props -name tree6 -diameter 2.0 -height 2.0 \
#      -texture finish_n -colour {255 93 252} -polyhedron $tree_poly \
#      -size_varies 0.0 

#tux_load_texture finish_s s.rgb 0
#tux_tree_props -name tree7 -diameter 2.0 -height 2.0 \
#      -texture finish_s -colour {251 125 250} -polyhedron $tree_poly \
#      -size_varies 0.0 

#tux_load_texture finish_h h.rgb 0
#tux_tree_props -name tree8 -diameter 2.0 -height 2.0 \
#      -texture finish_h -colour {252 161 251} -polyhedron $tree_poly \
#      -size_varies 0.0

tux_load_texture flag1 flag.rgb 0
tux_item_spec -name flag -diameter 1.0 -height 1.0 \
      -texture flag1 -colour {194 40 40} -nocollision
      
tux_load_texture finish finish.rgb 0
tux_item_spec -name finish -diameter 9.0 -height 6.0 \
		-texture finish -colour {255 255 0} -nocollision \
                -normal {0 0 1}

tux_load_texture start start.rgb 0
tux_item_spec -name start -diameter 9.0 -height 6.0 \
		-texture start -colour {128 128 0} -nocollision \
                -normal {0 0 1}

tux_item_spec -name float -nocollision -colour {255 128 255} -reset_point

tux_trees "$cwd/trees.rgb"            ;# bitmap specifying tree locations

tux_ice_tex ice.rgb     ;# ice image
tux_rock_tex rock.rgb   ;# rock image
tux_snow_tex snow.rgb   ;# snow image

tux_friction 0.22 0.9 0.35     ;# ice, rock, snow friction coefficients

#
# Introductory animation keyframe data
#
source tux_walk.tcl

#
# Lighting
#
set conditions [tux_get_race_conditions]
if { $conditions == "sunny" } {
    source sunny_light.tcl
} elseif { $conditions == "cloudy" } {
    source foggy_light.tcl
} elseif { $conditions == "night" } {
    source night_light.tcl
} 

cd $cwd
