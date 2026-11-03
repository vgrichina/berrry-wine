'use strict';
// Independent literal query and boundary oracles.
module.exports = {
  "purpose": "Independent literal query and storage-boundary oracles",
  "unsigned": [
    {
      "name": "ubyte-low5",
      "bits": 8,
      "raw": [
        7,
        8
      ],
      "stored5": [
        0,
        1
      ],
      "stored8": [
        7,
        8
      ],
      "floatCollision": false,
      "queryF32": [
        0.027450980618596077,
        0.0313725508749485
      ],
      "queryF32Bits": [
        "0x3ce0e0e1",
        "0x3d008081"
      ]
    },
    {
      "name": "ubyte-mid8",
      "bits": 8,
      "raw": [
        127,
        128
      ],
      "stored5": [
        15,
        16
      ],
      "stored8": [
        127,
        128
      ],
      "floatCollision": false,
      "queryF32": [
        0.49803921580314636,
        0.501960813999176
      ],
      "queryF32Bits": [
        "0x3efefeff",
        "0x3f008081"
      ]
    },
    {
      "name": "ushort-low5",
      "bits": 16,
      "raw": [
        2047,
        2048
      ],
      "stored5": [
        0,
        1
      ],
      "stored8": [
        7,
        8
      ],
      "floatCollision": false,
      "queryF32": [
        0.031235218048095703,
        0.0312504768371582
      ],
      "queryF32Bits": [
        "0x3cffe100",
        "0x3d000080"
      ]
    },
    {
      "name": "ushort-mid8",
      "bits": 16,
      "raw": [
        32767,
        32768
      ],
      "stored5": [
        15,
        16
      ],
      "stored8": [
        127,
        128
      ],
      "floatCollision": false,
      "queryF32": [
        0.49999237060546875,
        0.5000076293945312
      ],
      "queryF32Bits": [
        "0x3effff00",
        "0x3f000080"
      ]
    },
    {
      "name": "uint-low5",
      "bits": 32,
      "raw": [
        134217727,
        134217728
      ],
      "stored5": [
        0,
        1
      ],
      "stored8": [
        7,
        8
      ],
      "floatCollision": true,
      "rgb555X1": [
        "0x8000",
        "0x8421"
      ],
      "queryF32": [
        0.03125,
        0.03125
      ],
      "queryF32Bits": [
        "0x3d000000",
        "0x3d000000"
      ]
    },
    {
      "name": "uint-mid8",
      "bits": 32,
      "raw": [
        2147483647,
        2147483648
      ],
      "stored5": [
        15,
        16
      ],
      "stored8": [
        127,
        128
      ],
      "floatCollision": true,
      "rgba8Opaque": [
        "0xff7f7f7f",
        "0xff808080"
      ],
      "queryF32": [
        0.5,
        0.5
      ],
      "queryF32Bits": [
        "0x3f000000",
        "0x3f000000"
      ]
    }
  ],
  "signedQuery": [
    {
      "bits": 8,
      "rawSigned": [
        -128,
        -1,
        0,
        1,
        127
      ],
      "queryF32": [
        -1.0,
        -0.003921568859368563,
        0.003921568859368563,
        0.0117647061124444,
        1.0
      ],
      "queryF32Bits": [
        "0xbf800000",
        "0xbb808081",
        "0x3b808081",
        "0x3c40c0c1",
        "0x3f800000"
      ],
      "pixelOracle": "pending explicit internal m; no invented universal signed bit truncation"
    },
    {
      "bits": 16,
      "rawSigned": [
        -32768,
        -1,
        0,
        1,
        32767
      ],
      "queryF32": [
        -1.0,
        -1.5259021893143654e-05,
        1.5259021893143654e-05,
        4.577706567943096e-05,
        1.0
      ],
      "queryF32Bits": [
        "0xbf800000",
        "0xb7800080",
        "0x37800080",
        "0x384000c0",
        "0x3f800000"
      ],
      "pixelOracle": "pending explicit internal m; no invented universal signed bit truncation"
    },
    {
      "bits": 32,
      "rawSigned": [
        -2147483648,
        -1,
        0,
        1,
        2147483647
      ],
      "queryF32": [
        -1.0,
        -2.3283064365386963e-10,
        2.3283064365386963e-10,
        6.984919309616089e-10,
        1.0
      ],
      "queryF32Bits": [
        "0xbf800000",
        "0xaf800000",
        "0x2f800000",
        "0x30400000",
        "0x3f800000"
      ],
      "pixelOracle": "pending explicit internal m; no invented universal signed bit truncation"
    }
  ],
  "floatControls": [
    0,
    0.03125,
    0.5,
    1,
    -0.5,
    1.5
  ],
  "mixedProvenance": [
    "uint-low5 then float .03125 then uint-low5",
    "uint-mid8 then float .5 then uint-mid8"
  ],
  "pass": true
};
