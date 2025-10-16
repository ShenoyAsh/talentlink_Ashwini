import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Form, Button, Spinner, Alert, ListGroup, InputGroup } from 'react-bootstrap';

const MessagingPage = () => {
    const { user, axiosInstance } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [receiver, setReceiver] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const response = await axiosInstance.get('/messages/');
                setMessages(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch messages.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // Long polling
        return () => clearInterval(interval);
    }, [axiosInstance]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post('/messages/', {
                receiver: receiver,
                content: newMessage,
            });
            setNewMessage('');
            // No need to setReceiver('') if you want to continue messaging the same person
        } catch (err) {
            setError('Failed to send message.');
            console.error(err);
        }
    };

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <h1>Messages</h1>
            <ListGroup className="mb-3">
                {messages.map(message => (
                    <ListGroup.Item key={message.id}>
                        <strong>{message.sender}: </strong>{message.content}
                    </ListGroup.Item>
                ))}
            </ListGroup>
            <Form onSubmit={handleSendMessage}>
                <InputGroup className="mb-3">
                    <Form.Control
                        type="text"
                        placeholder="Receiver Username"
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        required
                    />
                    <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Your message"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        required
                    />
                    <Button type="submit">Send</Button>
                </InputGroup>
            </Form>
        </Container>
    );
};

export default MessagingPage;