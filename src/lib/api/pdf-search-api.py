import intersystems_iris.dbapi._DBAPI as dbapi
from sentence_transformers import SentenceTransformer
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from transformers import AutoModel, AutoTokenizer
import pdfplumber
import numpy as np
import asyncio
from dotenv import load_dotenv, find_dotenv
from pathlib import Path
import os
import requests
from google import genai
import json

config = {
    "hostname": "localhost",
    "port": 1972,
    "namespace": "USER",
    "username": "demo",
    "password": "demo",
}

# table_name = "pdftable"
# table_definition = "(id INT NOT NULL, sentence VARCHAR(1000), page INT, desc_vector VECTOR(DOUBLE, 384), PRIMARY KEY (id))"

conn = dbapi.connect(**config)
cursor = conn.cursor()

model = SentenceTransformer('all-MiniLM-L6-v2')

load_dotenv()
GEMINI_API_KEY = os.getenv("REACT_APP_GEMINI_API_KEY")

gemini_client = genai.Client(api_key = GEMINI_API_KEY)

table_name = "pdftable"
table_definition = "(sentence VARCHAR(40000), filename VARCHAR(100), page INT, desc_vector VECTOR(DOUBLE, 384))"

# UNCOMMENT THIS PART TO CLEAR THE TABLE
# try:
#     cursor.execute(f"DROP TABLE {table_name}")
# except:
#     pass
# cursor.execute(f"CREATE TABLE {table_name} {table_definition}")
        
        
        # cursor.execute(f"SELECT * from {table_name}")
        # data = cursor.fetchall()
        # print(data)
        # exit(0)

app = FastAPI()

# Load the transformer model and tokenizer
# model_name = "sentence-transformers/all-MiniLM-L6-v2"
# model = AutoModel.from_pretrained(model_name)
# tokenizer = AutoTokenizer.from_pretrained(model_name)

# Define a route for uploading a PDF file
@app.post("/upload_pdf")
async def upload_pdf(file: str):
    # cursor.execute(f"select max(id) from {table_name}")
    # max_id = cursor.fetchone()[0]
    # if max_id is None:
    #     max_id = 0
    # Extract sentences from the PDF file
    sentences = []
    pages = []
    maxlensen = 0
    with pdfplumber.open(file) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            new_sentences = text.split(". ")
            sentences.extend(new_sentences)
            pages.extend([page_num+1]*len(new_sentences))
            maxlensen = max(maxlensen, max(len(s) for s in new_sentences))
            print("page", page_num, "done processing")
    # print(maxlensen, "maxlensen")
    # Generate embeddings for each sentence
    embeddings = []
    # print(len(sentences), "sentences")
    for i, sentence in enumerate(sentences):
        # inputs = tokenizer.encode_plus(sentence, return_tensors="pt")
        # outputs = model(inputs["input_ids"], attention_mask=inputs["attention_mask"])
        # embedding = outputs.last_hidden_state[:, 0, :].numpy()[0]
        embedding = ",".join(str(x) for x in model.encode(sentence, normalize_embeddings=True).tolist())
        embeddings.append(embedding)
        if i % 100 == 0:
            print("embedding", i, "done processing")

    # Store the embeddings in the IRIS vector database
    sql = f"Insert into {table_name} (sentence, filename, page, desc_vector) VALUES (?, ?, ?, TO_VECTOR(?))"
    # params = [(int(max_id) + 1 + i, sentence, page, embedding) for i, (sentence, page, embedding) in enumerate(zip(sentences, pages, embeddings))]
    params = [(sentence.encode('ascii', 'ignore').decode(), file, page, embedding) for (sentence, page, embedding) in zip(sentences, pages, embeddings)]
    # print("\n".join(str(param) for param in params))
    print("beginning insert")
    cursor.executemany(sql, params)
    print("finished insert")

    return JSONResponse(content={"message": "PDF uploaded and embeddings generated"}, status_code=200)

# Define a route for searching for relevant sentences
@app.post("/search_sentences")
async def search_sentences(question: str, count: int):
    # Generate an embedding for the question
    question_embedding = ",".join(str(x) for x in model.encode(question))
    # print("beginning search")
    # Search for relevant sentences in the IRIS vector database
    cursor.execute(f"""SELECT TOP ? sentence, filename, page 
                   FROM {table_name} 
                   ORDER BY VECTOR_DOT_PRODUCT(desc_vector, TO_VECTOR(?)) DESC""", 
                   [count, question_embedding])
    results = cursor.fetchall()

    
    print("\n".join(str(result) for result in results))

    gemini_prompt = f"Given the following list of sentences AND YOUR OWN KNOWLEDGE, answer this question in 3-5 bullet points (similar to something you'd put on a slideshow) and give a list of filename-page number pairs of input sentences you used: {question} in this format: '+++filename---number+++filename---number+++etc.'. The sentences are: " + "\n".join(str(result) for result in results) + """
    . Do not say 'based on the text snippets' or anything similar which talks about the sentences, just start the answer directly.
      If you can't come up with something based on the input sentences, just give an answer TO THE SPECIFIC QUESTION THAT YOU WERE ASKED based on your other knowledge
      USE STANDARD MARKDOWN FORMATTING IN YOUR RESPONSE -- THIS IS VERY IMPORTANT
      """
    print("PROMPT:", gemini_prompt)
    # params = {
    #     "api_key": GEMINI_API_KEY,
    #     "input": gemini_prompt,
    #     "task": "text-generation",
    #     "style": "sentence"
    # }

    # response = requests.post("https://api.gemini.ai/generate", json=params)
    # generated_sentence = response.json()["output"]
    response = gemini_client.models.generate_content(
        model="gemini-2.0-flash", contents=gemini_prompt
    )
    print("generating...")
    print(response.text)

    response_arr = response.text.split("+++")
    # print(response_arr)
    page_nums = []
    if len(response_arr) != 1:
        page_nums_str = response_arr[1:]
        for page_num_str in page_nums_str:
            page_num_str = page_num_str.strip()
            if "-" in page_num_str:
                arr = page_num_str.split("---")
                if len(arr) < 2:
                    continue
                filename, page_num = arr[:2]
                if not page_num.isnumeric():
                    continue
                page_nums.append((filename.strip(), int(page_num)))
    page_nums_only = [page_num for filename, page_num in page_nums]

    response = JSONResponse(content={"explanation": response.text, "file-page-pairs": page_nums, "page-nums":page_nums_only, "sentences": results}, status_code=200)
    print(page_nums)
    print(results)
    # Return the relevant sentences
    return response

# if __name__ == "__main__":
    # asyncio.run(upload_pdf("/Users/siddhbamb/Documents/Programming/TreeHacks25/engage-ai/src/lib/api/sample-5-page-pdf-a4-size.pdf"))
    # asyncio.run(search_sentences("How do you do marketing?"))
    # asyncio.run(upload_pdf("Chapter9.pdf"))
    # asyncio.run(upload_pdf("cliffs_calculus.pdf"))
    # asyncio.run(search_sentences("Can you explain the concept of Lamport's distributed mutual exclusion to me, specifically how the critical section works?", 20))
   
    # PERFECT EXAMPLE!!!!
    # asyncio.run(upload_pdf("introcalc.pdf"))
    # asyncio.run(search_sentences("Can you explain what a limit is to me?", 5))
