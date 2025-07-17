// iframe Context.jsx
import React, { useEffect, useState } from 'react';

const Context = React.createContext();

function ContextProvider({ children }) {
  const [data, setData] = useState([]);

  const [language, setLanguage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    const saved = localStorage.getItem("lang");

    const lang = urlLang || saved || "de";
    localStorage.setItem("lang", lang);
    return lang;
  });

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem("lang", lang);
    console.log(lang);
  };

  useEffect(() => {
    const getData = async () => {
 //   const url = `/react-chat-prompt-2/data-de-ai.json`;
      const url = `/react-chat-prompt-2/data-${language}-ai.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(response.status);
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    getData();
  }, [language]);

  return (
    <Context.Provider value={{ data, language, changeLanguage }}>
      {children}
    </Context.Provider>
  );
}

export { Context, ContextProvider };
