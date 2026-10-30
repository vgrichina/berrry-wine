# Tux Racer initialization script

#
# Save data directory
# 
set tux_data_dir [pwd]

#
# Useful subroutines
#
proc tux_goto_data_dir {} {
    global tux_data_dir
    cd $tux_data_dir
}

proc tux_course_init {} {
    global tux_data_dir
    source "$tux_data_dir/courses/common/courseinit.tcl"
} 

#
# Read course index
#
source courses/course_idx.tcl

#
# Set Up Music
#

# Splash & Start screens
if { [tux_load_music start_screen music/start1-jt.it] } {
    tux_bind_music splash_screen start_screen -1
    tux_bind_music start_screen start_screen -1
}

# Options screen
if { [tux_load_music options_screen music/options1-jt.it] } {
    tux_bind_music credits_screen options_screen -1
}

# Music played during race
if { [tux_load_music racing music/race1-jt.it] } {
    tux_bind_music intro racing -1
    tux_bind_music racing racing -1
    tux_bind_music paused racing -1
}

# Game Over screen
if { [tux_load_music game_over music/wonrace1-jt.it] } {
    tux_bind_music game_over game_over 1
}


#
# Set Up Sounds
#

# Tree Hit
if { [tux_load_sound tree_hit1 sounds/tux_hit_tree1.wav] } {
    tux_bind_sounds tree_hit tree_hit1 
}

# Fish Pickup
if { [tux_load_sound fish_pickup_sound_1 sounds/fish_pickup1.wav]&& 
     [tux_load_sound fish_pickup_sound_2 sounds/fish_pickup2.wav]&& 
     [tux_load_sound fish_pickup_sound_3 sounds/fish_pickup3.wav] } \
{
    tux_bind_sounds item_collect fish_pickup_sound_1 \
	                         fish_pickup_sound_2 \
				 fish_pickup_sound_3
}

# Snow Sliding
if { [tux_load_sound snow_sound sounds/tux_on_snow1.wav] } {
    tux_bind_sounds snow_sound snow_sound
    tux_bind_sounds flying_sound snow_sound
}

# Rock Sliding
if { [tux_load_sound rock_sound sounds/tux_on_rock1.wav] } {
    tux_bind_sounds rock_sound rock_sound
}

# Ice Sliding
if { [tux_load_sound ice_sound sounds/tux_on_ice1.wav] } {
    tux_bind_sounds ice_sound ice_sound
}

# Track marks
tux_load_texture track_head courses/common/buttstart.rgb 1
tux_load_texture track_mark courses/common/buttprint.rgb 1
tux_load_texture track_tail courses/common/buttstop.rgb 1
tux_bind_texture track_head track_head
tux_bind_texture track_mark track_mark
tux_bind_texture track_tail track_tail

# Splash screen
tux_load_texture splash_screen_tr textures/splash_tr.rgb 0
tux_load_texture splash_screen_br textures/splash_br.rgb 0
tux_load_texture splash_screen_tl textures/splash_tl.rgb 0
tux_load_texture splash_screen_bl textures/splash_bl.rgb 0

tux_bind_texture splash_screen_tr splash_screen_tr
tux_bind_texture splash_screen_br splash_screen_br
tux_bind_texture splash_screen_tl splash_screen_tl
tux_bind_texture splash_screen_bl splash_screen_bl

# Snow Particle
tux_load_texture snow_particle courses/common/snowparticles.rgb 0
tux_bind_texture snow_particle snow_particle

# Fonts
tux_load_texture trebuchet_yel_blk fonts/trebuchet_yel_blk.rgb 0
tux_load_font -name trebuchet_yel_blk -file fonts/trebuchet.tfm \
              -texture trebuchet_yel_blk
tux_bind_font -binding time_label -font trebuchet_yel_blk -size 20
tux_bind_font -binding time_value -font trebuchet_yel_blk -size 30
tux_bind_font -binding time_hundredths -font trebuchet_yel_blk -size 20
tux_bind_font -binding herring_count -font trebuchet_yel_blk -size 30
tux_bind_font -binding speed_digits -font trebuchet_yel_blk -size 35
tux_bind_font -binding speed_units -font trebuchet_yel_blk -size 20
tux_bind_font -binding fps -font trebuchet_yel_blk -size 20 

tux_load_texture trebuchet_white fonts/trebuchet_white.rgb 0
tux_load_font -name trebuchet_white -file fonts/trebuchet.tfm \
              -texture trebuchet_white
tux_bind_font -binding button_label -font trebuchet_white -size 30
tux_bind_font -binding button_label_hilit -font trebuchet_white -size 30 \
              -colour { 1.00 0.89 0.01 1.0 }
tux_bind_font -binding button_label_disabled -font trebuchet_white -size 30 \
              -colour { 1.0 1.0 1.0 0.5 }
tux_bind_font -binding menu_label -font trebuchet_white -size 30
tux_bind_font -binding listbox_item -font trebuchet_white -size 22 \
              -colour { 1.00 0.89 0.01 1.0 }
tux_bind_font -binding event_and_cup_label -font trebuchet_white -size 22 
tux_bind_font -binding race_description -font trebuchet_white -size 16
tux_bind_font -binding race_requirements_label -font trebuchet_white -size 13 \
              -colour { 1.00 0.95 0.01 1.0 }
tux_bind_font -binding race_requirements -font trebuchet_white -size 13
tux_bind_font -binding cup_status -font trebuchet_white -size 16 \
              -colour { 1.00 0.89 0.01 1.0 }
tux_bind_font -binding race_over -font trebuchet_yel_blk -size 40
tux_bind_font -binding race_stats -font trebuchet_yel_blk -size 25
tux_bind_font -binding race_stats_label -font trebuchet_yel_blk -size 25
tux_bind_font -binding race_result_msg -font trebuchet_yel_blk -size 25
tux_bind_font -binding paused -font trebuchet_yel_blk -size 40

tux_bind_font -binding credits_h1 -font trebuchet_yel_blk -size 30
tux_bind_font -binding credits_h2 -font trebuchet_yel_blk -size 20
tux_bind_font -binding credits_text -font trebuchet_white -size 20
tux_bind_font -binding credits_text_small -font trebuchet_white -size 14

tux_bind_font -binding loading -font trebuchet_yel_blk -size 30

# HUD
tux_load_texture herring_icon textures/herringicon.rgb 0
tux_bind_texture herring_icon herring_icon

tux_load_texture gauge_outline textures/gaugeoutline.rgb 0
tux_bind_texture gauge_outline gauge_outline

tux_load_texture gauge_energy_mask textures/gaugeenergymask.rgb 0
tux_bind_texture gauge_energy_mask gauge_energy_mask

tux_load_texture gauge_speed_mask textures/gaugespeedmask.rgb 0
tux_bind_texture gauge_speed_mask gauge_speed_mask

# UI widgets
tux_load_texture listbox_arrows textures/listbox_arrows.rgb 0
tux_bind_texture listbox_arrows listbox_arrows
tux_bind_texture textarea_arrows listbox_arrows

tux_load_texture mirror_button textures/mirror_button.rgb 0
tux_bind_texture mirror_button mirror_button

tux_load_texture conditions_button textures/conditions_button.rgb 0
tux_bind_texture conditions_button conditions_button

tux_load_texture snow_button textures/snow_button.rgb 0
tux_bind_texture snow_button snow_button

tux_load_texture wind_button textures/wind_button.rgb 0
tux_bind_texture wind_button wind_button


# Menu decorations
tux_load_texture menu_bottom_left textures/menu_bottom_left.rgb 0
tux_bind_texture menu_bottom_left menu_bottom_left

tux_load_texture menu_bottom_right textures/menu_bottom_right.rgb 0
tux_bind_texture menu_bottom_right menu_bottom_right

tux_load_texture menu_top_left textures/menu_top_left.rgb 0
tux_bind_texture menu_top_left menu_top_left

tux_load_texture menu_top_right textures/menu_top_right.rgb 0
tux_bind_texture menu_top_right menu_top_right

tux_load_texture menu_title textures/menu_title.rgb 0
tux_bind_texture menu_title menu_title

# Tux life icon
tux_load_texture tux_life textures/tuxlife.rgb 0
tux_bind_texture tux_life tux_life

# Mouse cursor
tux_load_texture mouse_cursor textures/mouse_cursor.rgb 0
tux_bind_texture mouse_cursor mouse_cursor
