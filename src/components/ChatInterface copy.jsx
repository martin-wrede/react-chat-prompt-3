import React from 'react';
import { Upload, X, File, Download } from 'lucide-react';
import { formatFileSize } from '../utils/fileUtils'; // Import our new utility

const ChatInterface = ({
  data,
  messages,
  isLoading,
  inputMessage,
  setInputMessage,
  uploadedFiles,
  handleFileUpload,
  deleteFile,
  sendMessage,
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <h2>{data && data.app_Headline2}</h2>

      {/* Chat Messages Container */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            {data?.chat_startConversation || 'Beginne eine Unterhaltung...'}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`message ${
                message.role === 'user' ? 'message-user' :
                message.role === 'system' ? 'message-system' : 'message-assistant'
              }`}
            >
              <strong>
                {message.role === 'user' ? (data?.chat_youLabel || 'Du:') :
                 message.role === 'system' ? (data?.chat_systemLabel || 'System:') : (data?.chat_aiLabel || 'AI:')}
              </strong>
              <div className="message-content" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
              
              {message.role === 'assistant' && message.importedEvents > 0 && (
                 <div className="import-success-indicator">
                    ✅ {(data?.chat_importedToRoadmap || '{count} Termine automatisch in den Projektplan importiert').replace('{count}', message.importedEvents)}
                 </div>
              )}
              
              {message.role === 'assistant' && message.downloadLinks && message.downloadLinks.length > 0 && (
                <div className="download-links">
                  <h4>{data?.chat_downloadFilesLabel || 'Download-Dateien:'}</h4>
                  {message.downloadLinks.map((link, linkIndex) => (
                    <button key={linkIndex} onClick={link.download} className="download-button">
                      <Download size={14} /> {link.filename}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && <div className="message message-loading">{data?.chat_aiTyping || 'AI tippt...'}</div>}
      </div>

      {/* File Upload Section */}
      <div className="file-section">
        <div className="file-upload-header">
          <label className="upload-button">
            <Upload size={16} />
            {data?.chat_uploadFilesLabel || 'Text- und Kalender-Dateien hochladen'}
            <input type="file" multiple accept=".txt,.ics,.json" onChange={handleFileUpload} className="file-input" />
          </label>
          <span className="file-hint">{data?.chat_fileHint || '.txt, .json und .ics Dateien erlaubt'}</span>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h4>{(data?.chat_uploadedFilesTitle || 'Hochgeladene Dateien ({count}):').replace('{count}', uploadedFiles.length)}</h4>
            <div className="files-list">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="file-info">
                    <File size={14} />
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">{formatFileSize(file.size)} • {file.type}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteFile(file.id)} className="delete-button" title="Datei löschen">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="input-area">
        <textarea
          placeholder={data?.chat_messagePlaceholder || 'Schreibe deine Nachricht...'}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          className="message-input"
          rows={2}
        />
        <button onClick={sendMessage} disabled={isLoading || (!inputMessage.trim() && uploadedFiles.length === 0)} className="send-button">
          {isLoading ? (data?.chat_sendingButton || 'Senden...') : (data?.chat_sendButton || 'Senden')}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;