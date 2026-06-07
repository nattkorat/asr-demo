import kenlm
from pyctcdecode import build_ctcdecoder

import os

def _get_unigrams(path: str):
    """Read unigrams txt file.
    """
    with open(path, "r", encoding="utf-8") as file:
        unigrams = [t.strip() for t in file.readlines()]
    return unigrams
    

    
def load_ngrams_decoder(
    model_dir: str, # binary path
    labels: list, # list of the alphabet from accoustic model
    alpha: float = 0.5, # default from pyctcdecode
    beta: float = 1.5 # default from pyctcdecode
):
    """
    Load KenLM N-grams model as the binary format supplimented by supported alphabet and unigrams.
    
    Parameters:
    ---------------
    model_path: str
        Path to the lm.banary file of the LM.
    lebels: list
        List of the supported alphabet supported by language model and accoustic model
    unigrams: list
        List of all words recognized by LM.
    alpha: float = 0.5
        Language model weight using to improve the accoustic confident from the logits level
    beta: float = 1.5
        Word bonus factor supporting for the long context.
    
    Return
    --------------
    decoder: BeamSearchDecoderCTC
        Beam search decoder from CTC of the accoustic model prediction.
    """
    n_grams_path = os.path.join(model_dir, "lm.binary")
    if not os.path.exists(n_grams_path):
        raise Exception(f"Couldn't find {n_grams_path}")
    
    unigrams = _get_unigrams(os.path.join(model_dir, "unigrams.txt"))
    
    decoder_wide = build_ctcdecoder(
        labels,
        n_grams_path,
        unigrams=unigrams,
        alpha=alpha,
        beta=beta
    )
   
    return decoder_wide

# expected lm model structure
#
# ./
    # lm.binary
    # unigrams.txt
