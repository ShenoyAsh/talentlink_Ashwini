// frontend/src/pages/MessagingPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import {
    Container, Form, Button, Spinner, Alert, ListGroup,
    InputGroup, Card, Row, Col, Badge
} from 'react-bootstrap';
import { Send, MessageSquare, UserPlus } from 'lucide-react'; // Added UserPlus icon

const MessagingPage = () => {
    const { user, axiosInstance } = useAuth();
    const [conversations, setConversations] = useState({});
    const [activeConversationUser, setActiveConversationUser] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true); // Initial load
    const [isSending, setIsSending] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [sendError, setSendError] = useState('');
    // State for starting a new conversation
    const [newChatUser, setNewChatUser] = useState('');
    const [newChatError, setNewChatError] = useState('');

    const messagesEndRef = useRef(null); // Ref to scroll to bottom

    // --- Utility Functions ---
    const scrollToBottom = useCallback(() => {
        // Use timeout to ensure DOM update before scrolling
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50); // Small delay
    }, []);

    // --- Data Fetching ---
    const fetchMessages = useCallback(async (isInitialLoad = false) => {
        if (!user) return;
        if (!isInitialLoad) {
             // Don't show main spinner or clear fetch errors on background poll
        } else {
             setLoading(true); // Show spinner only on initial load
             setFetchError('');
        }

        try {
            const response = await axiosInstance.get('/messages/');
            const fetchedMessages = response.data.results || response.data || [];

            // Group messages by conversation partner
            const groupedConversations = fetchedMessages.reduce((acc, msg) => {
                // Ensure msg.sender and msg.receiver are populated (check for potential nulls if backend allows)
                 const senderUsername = msg.sender; // Assuming serializer returns username string
                 const receiverUsername = msg.receiver; // Assuming serializer returns username string

                 // Defensive check in case sender/receiver is unexpectedly null/undefined
                 if (!senderUsername || !receiverUsername || !user?.username) {
                     console.warn("Skipping message due to missing sender/receiver:", msg);
                     return acc;
                 }

                const partnerUsername = senderUsername === user.username ? receiverUsername : senderUsername;

                if (!acc[partnerUsername]) {
                    acc[partnerUsername] = [];
                }

                // Add message only if it's not already present (handles polling overlap)
                if (!acc[partnerUsername].some(existing => existing.id === msg.id)) {
                     acc[partnerUsername].push(msg);
                     // Sort after pushing new message
                     acc[partnerUsername].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                 }

                return acc;
            }, {}); // Start with empty object

             // Preserve existing conversations if polling doesn't return them (in case API filters)
             // This merge logic might need adjustment based on how backend pagination/filtering works
            // setConversations(prev => ({ ...prev, ...groupedConversations }));
            // For simplicity with polling all messages, just set the new state:
             setConversations(groupedConversations);


            // Auto-select most recent chat only on initial load if none selected
            if (isInitialLoad && !activeConversationUser && Object.keys(groupedConversations).length > 0) {
                let latestTimestamp = 0;
                let latestUser = null;
                Object.entries(groupedConversations).forEach(([username, msgs]) => {
                    const lastMsg = msgs[msgs.length - 1];
                    if (lastMsg && new Date(lastMsg.timestamp).getTime() > latestTimestamp) {
                        latestTimestamp = new Date(lastMsg.timestamp).getTime();
                        latestUser = username;
                    }
                });
                if (latestUser) {
                    setActiveConversationUser(latestUser);
                }
            }

        } catch (err) {
            // Only set fetchError on initial load fail
            if (isInitialLoad) {
                setFetchError('Failed to fetch messages. Please try again later.');
            }
            console.error("Fetch messages error:", err.response?.data || err.message || err);
        } finally {
            if (isInitialLoad) setLoading(false); // Stop initial loading spinner
        }
    }, [user, axiosInstance, activeConversationUser]); // Include activeConversationUser? Maybe not needed for fetch dependency.

    // Initial fetch and polling setup
    useEffect(() => {
        fetchMessages(true); // Pass true for initial load
        const intervalId = setInterval(() => fetchMessages(false), 8000); // Poll every 8 seconds
        return () => clearInterval(intervalId);
    }, [fetchMessages]); // Depend on the memoized fetchMessages

    // Scroll effect
    useEffect(() => {
        if(activeConversationUser) { // Only scroll if a conversation is active
             scrollToBottom();
         }
    }, [activeConversationUser, conversations, scrollToBottom]); // Scroll when active user or messages change

    // --- Event Handlers ---
    const handleSelectConversation = (username) => {
        setActiveConversationUser(username);
        setSendError(''); // Clear errors when switching
        setNewChatError('');
        setNewMessage(''); // Clear input when switching
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault(); // Prevent default if called from form submit
        if (!newMessage.trim() || !activeConversationUser) return;

        setIsSending(true);
        setSendError('');

        try {
            const response = await axiosInstance.post('/messages/', {
                receiver_username: activeConversationUser,
                content: newMessage.trim(),
            });
            const sentMessage = response.data;

            // Optimistic update
            setConversations(prev => {
                const updated = { ...prev };
                if (!updated[activeConversationUser]) updated[activeConversationUser] = [];
                 // Ensure no duplicates if message arrives via polling nearly simultaneously
                if (!updated[activeConversationUser].some(msg => msg.id === sentMessage.id)) {
                    updated[activeConversationUser] = [...updated[activeConversationUser], sentMessage];
                     // Re-sort just to be safe, although appending should work
                     updated[activeConversationUser].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                 }
                return updated;
            });

            setNewMessage('');
            scrollToBottom(); // Scroll after optimistic update

        } catch (err) {
            const errorData = err.response?.data;
            let detailedError = "Failed to send message.";
            if (errorData) {
                // Extract specific field errors or general detail
                if (errorData.receiver_username) detailedError = `Receiver Error: ${errorData.receiver_username.join(', ')}`;
                else if (errorData.content) detailedError = `Message Error: ${errorData.content.join(', ')}`;
                else if (errorData.detail) detailedError = errorData.detail;
                else if (typeof errorData === 'object' && Object.keys(errorData).length > 0) {
                     detailedError = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
                }
                else if (typeof errorData === 'string') detailedError = errorData;
            }
            setSendError(detailedError);
            console.error('Send message error:', detailedError, err.response || err);
        } finally {
            setIsSending(false);
        }
    };

     // Handle starting a new chat
     const handleStartNewChat = () => {
         setNewChatError('');
         if (!newChatUser.trim()) {
             setNewChatError('Please enter a username.');
             return;
         }
         if (newChatUser.trim() === user.username) {
             setNewChatError('You cannot chat with yourself.');
             return;
         }
         // Check if conversation already exists
         if (!conversations[newChatUser.trim()]) {
             // Create an empty conversation locally to activate it
             setConversations(prev => ({ ...prev, [newChatUser.trim()]: [] }));
         }
         // Switch to this user (new or existing)
         setActiveConversationUser(newChatUser.trim());
         setNewChatUser(''); // Clear the input
     };


    // --- Render Logic ---

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" role="status"><span className="visually-hidden">Loading messages...</span></Spinner></Container>;
    }

    // Sort partners for display
    const conversationPartners = Object.entries(conversations)
        .sort(([, msgsA], [, msgsB]) => {
            const lastMsgTimeA = msgsA.length ? new Date(msgsA[msgsA.length - 1].timestamp).getTime() : 0;
            const lastMsgTimeB = msgsB.length ? new Date(msgsB[msgsB.length - 1].timestamp).getTime() : 0;
            return lastMsgTimeB - lastMsgTimeA;
        })
        .map(([username]) => username);

    const activeMessages = conversations[activeConversationUser] || [];

    return (
        <Container fluid className="py-3 vh-100 d-flex flex-column">
             <h1 className="mb-3 h4"><MessageSquare size={20} className="me-2"/>Messages</h1>

            {/* Show fetch error prominently if it occurs after initial load */}
            {fetchError && !loading && <Alert variant="warning" className="mb-2">{fetchError}</Alert>}

            <Row className="flex-grow-1" style={{ minHeight: 0 }}> {/* Ensure row takes up space */}

                {/* Sidebar */}
                <Col md={4} lg={3} className="d-flex flex-column mb-3 mb-md-0 h-100">
                    <Card className="flex-grow-1 d-flex flex-column">
                        <Card.Header className="fw-bold">Conversations</Card.Header>
                        {/* Input for new chat */}
                        <Card.Body className="p-2 border-bottom">
                             <InputGroup size="sm">
                                <Form.Control
                                    type="text"
                                    placeholder="Enter username to chat"
                                    value={newChatUser}
                                    onChange={(e) => setNewChatUser(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleStartNewChat(); }}
                                />
                                <Button variant="outline-secondary" onClick={handleStartNewChat}><UserPlus size={16}/></Button>
                            </InputGroup>
                            {newChatError && <small className="text-danger d-block mt-1 px-1">{newChatError}</small>}
                        </Card.Body>
                        {/* Conversation List */}
                        <ListGroup variant="flush" className="flex-grow-1" style={{ overflowY: 'auto' }}>
                            {conversationPartners.length > 0 ? (
                                conversationPartners.map(partner => (
                                    <ListGroup.Item
                                        key={partner}
                                        action
                                        active={partner === activeConversationUser}
                                        onClick={() => handleSelectConversation(partner)}
                                        className="d-flex justify-content-between align-items-center text-break"
                                    >
                                        {partner}
                                        {/* Optional: Unread badge */}
                                    </ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item className="text-muted text-center">No active conversations.</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card>
                </Col>

                {/* Main Chat Area */}
                <Col md={8} lg={9} className="d-flex flex-column h-100">
                    <Card className="flex-grow-1 d-flex flex-column"> {/* Card takes remaining height */}
                        <Card.Header>
                            {activeConversationUser ? (
                                <>Chat with <strong>{activeConversationUser}</strong></>
                            ) : (
                                'Select or start a conversation'
                            )}
                        </Card.Header>

                        {/* Message Display Area */}
                        <Card.Body className="d-flex flex-column" style={{ overflowY: 'auto' }}>
                            {!activeConversationUser ? (
                                <p className="text-muted text-center m-auto">Select a conversation from the list or start a new one.</p>
                            ) : activeMessages.length === 0 ? (
                                <p className="text-muted text-center m-auto">No messages yet. Send the first one!</p>
                            ) : (
                                <>
                                    {activeMessages.map((message, index) => ( // Added index for potential key issues
                                        <div
                                            key={message.id || `msg-${index}`} // Use index as fallback key
                                            className={`mb-2 d-flex ${message.sender === user.username ? 'justify-content-end' : 'justify-content-start'}`}
                                        >
                                            <div
                                                className={`p-2 rounded shadow-sm ${message.sender === user.username ? 'bg-primary text-white' : 'bg-light border'}`}
                                                style={{ maxWidth: '75%', wordBreak: 'break-word' }}
                                            >
                                                 {/* Content with pre-wrap for newlines */}
                                                 <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                                                 {/* Timestamp */}
                                                 <small className={`d-block text-end mt-1 ${message.sender === user.username ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7em' }}>
                                                      {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                  </small>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Scroll target */}
                                    <div ref={messagesEndRef} style={{ height: '1px' }} />
                                </>
                            )}
                        </Card.Body>

                        {/* Input Footer (only if conversation is active) */}
                        {activeConversationUser && (
                            <Card.Footer className="bg-light p-2 border-top">
                                {sendError && <Alert variant="danger" className="mb-2 py-1 px-2 small" onClose={() => setSendError('')} dismissible>{sendError}</Alert>}
                                <Form onSubmit={handleSendMessage}>
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            rows={1}
                                            placeholder="Type your message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            required
                                            disabled={isSending}
                                            style={{ resize: 'none', overflowY: 'auto' }} // Basic auto-height/scroll
                                             onKeyDown={(e) => {
                                                 if (e.key === 'Enter' && !e.shiftKey) {
                                                     e.preventDefault(); // Prevent newline
                                                     if (!isSending && newMessage.trim()) {
                                                         handleSendMessage(); // Call send handler
                                                     }
                                                 }
                                             }}
                                        />
                                        <Button type="submit" variant="primary" disabled={isSending || !newMessage.trim()}>
                                            {isSending ? <Spinner as="span" size="sm" animation="border" /> : <Send size={18} />}
                                        </Button>
                                    </InputGroup>
                                </Form>
                            </Card.Footer>
                        )}
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default MessagingPage;