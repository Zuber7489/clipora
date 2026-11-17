import re

# Comprehensive Devanagari to Latin (Hinglish) phonetics mapping
CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f', 'ड़': 'r', 'ढ़': 'rh'
}

VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'
}

MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ॉ': 'o', 'ॅ': 'e'
}

ANUSVARA = {'ं': 'n', 'ँ': 'n', 'ः': 'h'}
VIRAMA = '्'

# High-frequency podcast Hinglish vocabulary dictionary
COMMON_WORDS = {
    'भाई': 'bhai', 'क्या': 'kya', 'सीजन': 'season', 'सम': 'some',
    'फॉर': 'for', 'बलराज': 'balraj', 'नहीं': 'nahi', 'हाँ': 'haan',
    'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'था': 'tha', 'थी': 'thi',
    'थे': 'the', 'कहा': 'kaha', 'बोला': 'bola', 'करना': 'karna',
    'कर': 'kar', 'रहा': 'raha', 'रही': 'rahi', 'रहे': 'rahe',
    'बहुत': 'bahut', 'अच्छा': 'achha', 'बुरा': 'bura', 'लोग': 'log',
    'पैसा': 'paisa', 'पैसे': 'paise', 'काम': 'kaam', 'बात': 'baat',
    'दोस्त': 'dost', 'गाना': 'gaana', 'वीडियो': 'video', 'शो': 'show',
    'सब': 'sab', 'तू': 'tu', 'तुम': 'tum', 'आप': 'aap', 'मैं': 'main',
    'हम': 'hum', 'ये': 'ye', 'वो': 'wo', 'तो': 'to', 'भी': 'bhi'
}

def devanagari_to_hinglish(text: str) -> str:
    """
    Converts Hindi Devanagari script text into natural Roman-script Hinglish.
    E.g. 'भाई क्या सीजन' -> 'bhai kya season'
         'सम फॉर बलराज' -> 'some for balraj'
    """
    if not text or not any('\u0900' <= ch <= '\u097f' for ch in text):
        return text

    words = text.split()
    converted_words = []

    for word in words:
        clean_word = re.sub(r'[^\u0900-\u097f]', '', word)
        punct_prefix = re.match(r'^[^\u0900-\u097f]+', word)
        punct_suffix = re.search(r'[^\u0900-\u097f]+$', word)
        p_pre = punct_prefix.group(0) if punct_prefix else ''
        p_suf = punct_suffix.group(0) if punct_suffix else ''

        if clean_word in COMMON_WORDS:
            converted_words.append(p_pre + COMMON_WORDS[clean_word] + p_suf)
            continue

        chars = list(clean_word)
        n = len(chars)
        i = 0
        w_res = []

        while i < n:
            c = chars[i]
            next_c = chars[i+1] if i + 1 < n else ''
            
            # Nukta combination
            combined = c + next_c
            if combined in CONSONANTS:
                c = combined
                i += 1
                next_c = chars[i+1] if i + 1 < n else ''

            if c in VOWELS:
                w_res.append(VOWELS[c])
            elif c in CONSONANTS:
                base = CONSONANTS[c]
                if next_c == VIRAMA:
                    w_res.append(base)
                    i += 1
                elif next_c in MATRAS:
                    w_res.append(base + MATRAS[next_c])
                    i += 1
                elif not next_c or next_c in ' \t\n\r,.:;!?-"\'()[]' or next_c in VOWELS:
                    w_res.append(base)
                else:
                    w_res.append(base + 'a')
            elif c in MATRAS:
                w_res.append(MATRAS[c])
            elif c in ANUSVARA:
                w_res.append(ANUSVARA[c])
            elif c == VIRAMA:
                pass
            else:
                w_res.append(c)
            i += 1

        res_word = ''.join(w_res)
        converted_words.append(p_pre + res_word + p_suf)

    return ' '.join(converted_words)
