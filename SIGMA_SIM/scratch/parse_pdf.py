import PyPDF2

try:
    with open('../../1_TSI/UTIC_CrossRoadInfoService.pdf', 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ''
        for page in reader.pages:
            text += page.extract_text()
        print(text)
except Exception as e:
    print("Error:", e)
