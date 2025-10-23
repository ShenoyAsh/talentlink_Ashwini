// frontend/src/pages/NotificationsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, ListGroup, Spinner, Alert, Button, Badge } from 'react-bootstrap';
import { Check, CheckCheck } from 'lucide-react'; // Import icons

const NotificationsPage = () => {
    const { user, axiosInstance } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchNotifications = async () => {
        setLoading(true);
        setError('');
        if (!user) {
            setError("You must be logged in to view notifications.");
            setLoading(false);
            return;
        }
        try {
            const response = await axiosInstance.get('/notifications/'); // Fetch all notifications
            setNotifications(response.data.results || response.data); // Handle pagination if any
        } catch (err) {
            setError('Failed to fetch notifications.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user, axiosInstance]); // Refetch if user changes

    const markAsRead = async (id) => {
        try {
            await axiosInstance.patch(`/notifications/${id}/mark_read/`);
            // Update UI optimistically
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
            alert("Could not mark notification as read.");
        }
    };

    const markAllRead = async () => {
        try {
            await axiosInstance.post(`/notifications/mark-all-read/`);
            // Update UI optimistically
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error("Failed to mark all as read:", error);
             alert("Could not mark all notifications as read.");
        }
    };

     const hasUnread = notifications.some(n => !n.read);

    return (
        <Container className="py-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                 <h1>Notifications</h1>
                 {hasUnread && (
                    <Button variant="outline-secondary" size="sm" onClick={markAllRead}>
                        <CheckCheck size={16} className="me-1" /> Mark All as Read
                    </Button>
                )}
            </div>

            {loading ? <div className="text-center"><Spinner animation="border" /></div> :
             error ? <Alert variant="danger">{error}</Alert> :
             notifications.length > 0 ? (
                <ListGroup>
                    {notifications.map(n => (
                        <ListGroup.Item key={n.id} className={`d-flex justify-content-between align-items-start ${!n.read ? 'list-group-item-light fw-bold' : ''}`}>
                             <div>
                                <small className="text-muted">{new Date(n.timestamp).toLocaleString()}</small>
                                <p className="mb-0">{n.message}</p>
                                {/* Optional: Add links based on related object IDs if needed */}
                            </div>
                             {!n.read && (
                                <Button variant="link" size="sm" onClick={() => markAsRead(n.id)} title="Mark as read">
                                    <Check size={18} />
                                </Button>
                            )}
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            ) : (
                <Alert variant="info">You have no notifications.</Alert>
            )}
        </Container>
    );
};

export default NotificationsPage;