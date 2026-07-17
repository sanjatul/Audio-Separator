"""
Wrapper script that monkey-patches torchaudio.load / torchaudio.save to use
soundfile (instead of the torchcodec backend that newer torchaudio defaults to)
and then invokes Demucs.

Run as:  python -m app._demucs_wrapper [demucs args...]
"""

import sys
import types

import numpy as np
import soundfile as sf
import torch
import torchaudio


# ---------------------------------------------------------------------------
# Patch torchaudio I/O so Demucs never touches torchcodec
# ---------------------------------------------------------------------------
def _patched_load(uri, *args, **kwargs):
    data, sr = sf.read(str(uri), dtype="float32", always_2d=True)
    tensor = torch.from_numpy(data.T)
    return tensor, sr


def _patched_save(uri, src, sample_rate, *args, **kwargs):
    wav = src.numpy()
    if wav.ndim == 2:
        wav = wav.T
    sf.write(str(uri), wav, sample_rate, subtype="PCM_16")


torchaudio.load = _patched_load
torchaudio.save = _patched_save

# ---------------------------------------------------------------------------
# Now run Demucs
# ---------------------------------------------------------------------------
from demucs.__main__ import main

main()
