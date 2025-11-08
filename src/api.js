import axios from "axios";

export const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL, // uses Render backend URL in deployment
  headers: { "Content-Type": "application/json" },
});
