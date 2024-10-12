import "@blocksuite/presets/themes/affine.css";

import { AffineSchemas } from "@blocksuite/blocks";
import { AffineEditorContainer } from "@blocksuite/presets";
import { Schema } from "@blocksuite/store";
import { DocCollection, Text } from "@blocksuite/store";
import * as Y from "yjs"; // Import Yjs utilities

const API_URL = "https://670a8fcdac6860a6c2c9dee5.mockapi.io/documents"; // Your backend URL

const schema = new Schema().register(AffineSchemas);
const collection = new DocCollection({ schema });
collection.meta.initialize();

const doc = collection.createDoc();
const editor = new AffineEditorContainer();
editor.doc = doc;
document.body.append(editor);

// Function to encode Uint8Array to Base64 string
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Function to decode Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const uint8Array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    uint8Array[i] = binary.charCodeAt(i);
  }
  return uint8Array;
}

// Flag to prevent infinite save loops
let isApplyingUpdate = false;

// Debounce timer
let saveDocTimeout: any = null;

// Function to save the document state to the backend
async function saveDoc() {
  if (isApplyingUpdate) return; // Don't save if we are applying updates
  const ydoc = doc.spaceDoc; // Get the Y.Doc

  // Encode the document's state as a Uint8Array
  const state = Y.encodeStateAsUpdate(ydoc);

  // Convert Uint8Array to Base64 string for transmission
  const stateBase64 = uint8ArrayToBase64(state);

  // Send the state to the API
  try {
    // Delete existing documents (simplifying for single-document use case)
    await clearDoc();

    const response = await fetch(`${API_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: stateBase64 }),
    });
    if (!response.ok) {
      throw new Error("Failed to save document");
    }
    console.log("Document saved to backend");
  } catch (error) {
    console.error("Error saving document:", error);
  }
}

// Function to load the document state from the backend
async function loadDoc() {
  try {
    // Fetch the list of documents (assuming the API returns an array)
    const response = await fetch(`${API_URL}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load document");
    }

    const documents = await response.json();

    if (documents.length === 0) {
      console.warn("No document found in backend");
      return;
    }

    // Assuming we take the first document
    const data = documents[0];
    const stateBase64 = data.state;

    // Convert Base64 string back to Uint8Array
    const state = base64ToUint8Array(stateBase64);

    // Apply the update to the existing doc's Y.Doc
    isApplyingUpdate = true;
    Y.applyUpdate(doc.spaceDoc, state);
    isApplyingUpdate = false;

    doc.load(); // Load the doc

    console.log("Document loaded from backend");
  } catch (error) {
    console.error("Error loading document:", error);
  }
}

// Function to clear the document from the backend
async function clearDoc() {
  try {
    // Fetch the list of documents to get their IDs
    const response = await fetch(`${API_URL}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch documents for deletion");
    }

    const documents = await response.json();

    // Delete each document
    for (const doc of documents) {
      const deleteResponse = await fetch(`${API_URL}/${doc.id}`, {
        method: "DELETE",
      });
      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete document with ID ${doc.id}`);
      }
    }

    console.log("All documents deleted from backend");
  } catch (error) {
    console.error("Error deleting documents:", error);
  }
}

// Function to create the document and save it
function createDoc() {
  doc.load(() => {
    const pageBlockId = doc.addBlock("affine:page", {
      title: new Text("Test"),
    });
    const surfaceId = doc.addBlock("affine:surface", {}, pageBlockId);
    const noteId = doc.addBlock("affine:note", {}, surfaceId);
    doc.addBlock(
      "affine:paragraph",
      { text: new Text("Hello World!") },
      noteId
    );

    // Save the document to the backend after creating it
    saveDoc();
  });

  // Listen for updates on the Y.Doc
  const ydoc = doc.spaceDoc;
  setupDocUpdateListener(ydoc);
}

// Function to set up the Y.Doc update listener
function setupDocUpdateListener(ydoc: Y.Doc) {
  ydoc.on("update", () => {
    if (!isApplyingUpdate) {
      // Debounce saving to avoid excessive calls
      if (saveDocTimeout) {
        clearTimeout(saveDocTimeout);
      }
      saveDocTimeout = setTimeout(() => {
        saveDoc();
      }, 500);
    }
  });
}

// Event listeners for buttons
const createBtn = document.getElementById("create-doc") as HTMLButtonElement;
createBtn.onclick = () => createDoc();

const loadBtn = document.getElementById("load-doc") as HTMLButtonElement;
loadBtn.onclick = () => loadDoc();

const clearBtn = document.getElementById("clear") as HTMLButtonElement;
clearBtn.onclick = () => clearDoc();

// Initialize the update listener
const ydoc = doc.spaceDoc;
setupDocUpdateListener(ydoc);
