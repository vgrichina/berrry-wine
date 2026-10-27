from drive import *
phase('newgame',[dict(action='snapshot'),dict(cmd='mousemove:98:296')]+steps(2)+[dict(cmd='click:98:296')]+steps(128)+[frame('newgame')])
fetch('newgame')
