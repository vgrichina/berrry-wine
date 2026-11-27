#!/bin/bash
# tl;dr: requeueA.sh -- on box A only: stop the breadth lane, run the spel30 decomposition
# lane cA now, then resume breadth lane A (finished tags skip), then depth lane dA.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
BR="--apps=spelunky_classic,metrojd_gm7,castle_gm5,age_of_wonders_demo,heroes2_demo,heroes3_demo,caesar3_demo,simcity2000_demo,red_alert_95_demo,wep16_lifegen,wep16_rattler --arms=m,off,off2,all --reps=5"
DA="--apps=castle_gm5,red_alert_95_demo,heroes2_demo,heroes3_demo,caesar3_demo --arms=off,all,lUo,lU7,lGm,lSse,lLad,lFd,lDf,pLazy,def --reps=5"
bash ~/sw/stop.sh
mv ~/out/A/lane.out ~/out/A/lane1.out
bash ~/sw/start.sh cA "--apps=spel30 --arms=dA,dA2,dB,dC,dD,dE,dF,dG,dZ,dZE --reps=6"
setsid nohup bash ~/sw/after.sh cA A "$BR" > ~/after-A.log 2>&1 < /dev/null &
setsid nohup bash ~/sw/after.sh A dA "$DA" > ~/after-dA.log 2>&1 < /dev/null &
sleep 1; pgrep -u user -af "[s]w/(after|lane).sh" | cut -c1-100
