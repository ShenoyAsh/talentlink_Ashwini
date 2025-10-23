// frontend/src/App.jsx
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

import { Navbar, Nav, Container, Button, Form, Card, Row, Col, Alert, Spinner, Badge, ListGroup, Modal, InputGroup, Image, Dropdown, Offcanvas } from 'react-bootstrap';
import { Briefcase, LogOut, User, DollarSign, Clock, PlusCircle, Search, Check, X, MessageSquare, Award, FileText, Bell, Edit, Trash2, Link as LinkIconLucide, Image as ImageIcon } from 'lucide-react'; // Added Bell, Edit, Trash2

// Import new/updated pages and components
import ProfilePage from './pages/ProfilePage'; // Assume this will be updated for Portfolio
import ContractsPage from './pages/ContractsPage';
import MessagingPage from './pages/MessagingPage';
import ReviewPage from './pages/ReviewPage';
import ProjectEditPage from './pages/ProjectEditPage'; // New
import ProposalEditPage from './pages/ProposalEditPage'; // New
import NotificationsPage from './pages/NotificationsPage'; // New

// Use environment variable or default
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';


// --- Axios Interceptor for Auth ---
const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 5000, // Increased timeout slightly
    headers: {
        'Content-Type': 'application/json', // Default content type
    }
});

// --- Authentication Context ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);
    const [tokens, setTokens] = useState(() => localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null);
    const [loading, setLoading] = useState(false); // For login/register process
    const [authLoading, setAuthLoading] = useState(true); // Initial auth check
    const navigate = useNavigate();
    const location = useLocation(); // Get current location

    // Refresh token logic reference
    const refreshIntervalRef = useRef();

    // Axios Request Interceptor
    useEffect(() => {
        const reqInterceptor = axiosInstance.interceptors.request.use(config => {
            const currentTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
            if (currentTokens?.access) {
                config.headers.Authorization = `Bearer ${currentTokens.access}`;
            }
            // Handle multipart form data for file uploads
            if (config.data instanceof FormData) {
                config.headers['Content-Type'] = 'multipart/form-data';
            } else {
                 config.headers['Content-Type'] = 'application/json';
            }
            return config;
        }, error => Promise.reject(error));

        setAuthLoading(false); // Finished initial setup

        return () => {
            axiosInstance.interceptors.request.eject(reqInterceptor);
        };
    }, []);

     // Axios Response Interceptor for Token Refresh (Simplified)
    useEffect(() => {
        const resInterceptor = axiosInstance.interceptors.response.use(
            response => response,
            async error => {
                const originalRequest = error.config;
                const currentTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;

                // Check for 401 Unauthorized and if it's not a token refresh request itself
                if (error.response?.status === 401 && currentTokens?.refresh && !originalRequest._retry) {
                    originalRequest._retry = true; // Mark to prevent infinite loops
                    try {
                        console.log("Attempting token refresh...");
                        const refreshResponse = await axios.post(`${API_URL}/token/refresh/`, {
                            refresh: currentTokens.refresh
                        });
                        const newTokens = { ...currentTokens, access: refreshResponse.data.access };
                        setTokens(newTokens);
                        localStorage.setItem('authTokens', JSON.stringify(newTokens));
                        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access}`;
                        originalRequest.headers['Authorization'] = `Bearer ${newTokens.access}`;
                        console.log("Token refreshed successfully.");
                        return axiosInstance(originalRequest); // Retry original request with new token
                    } catch (refreshError) {
                        console.error("Token refresh failed:", refreshError);
                        // Refresh failed, logout user
                        logout(false); // Pass false to prevent navigation if already on login
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axiosInstance.interceptors.response.eject(resInterceptor);
        };
    }, [tokens]); // Re-run if tokens change

    const login = async (username, password) => {
        setLoading(true);
        try {
            const tokenResponse = await axios.post(`${API_URL}/token/`, { username, password });
            const newTokens = tokenResponse.data;
            setTokens(newTokens);
            localStorage.setItem('authTokens', JSON.stringify(newTokens));
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access}`; // Use common for default

             // Fetch profile immediately after getting token
             const profileConfig = { headers: { Authorization: `Bearer ${newTokens.access}` } };
             // Use axios directly here to ensure the latest token is used before interceptor might kick in fully
             const profileResponse = await axios.get(`${API_URL}/profiles/`, profileConfig);

            // Find the profile belonging to the logged-in user (assuming username matches profile.user)
            // Adjust this logic if the API returns only the user's profile directly
            const userProfile = profileResponse.data.results?.find(p => p.user === username) || profileResponse.data.find(p => p.user === username);

            if (userProfile) {
                const userDetails = { username: userProfile.user, user_type: userProfile.user_type, profileId: userProfile.id, profilePicture: userProfile.profile_picture };
                setUser(userDetails);
                localStorage.setItem('user', JSON.stringify(userDetails));
                 console.log("Login successful, navigating to dashboard.");
                navigate('/dashboard');
            } else {
                 console.error("Profile not found for user:", username);
                 alert("Login succeeded but failed to retrieve user profile.");
                 // Log out if profile fetch fails?
                 logout(false);
            }

        } catch (error) {
            console.error("Login failed:", error.response?.data || error.message);
            alert(`Login failed: ${error.response?.data?.detail || 'Invalid credentials or server error.'}`);
            logout(false); // Clear any potentially bad state on login failure
        } finally {
            setLoading(false);
        }
    };

    // Modified logout to accept navigateAway flag
     const logout = (navigateAway = true) => {
         console.log("Logging out...");
         setUser(null);
         setTokens(null);
         localStorage.clear(); // Clear everything related to auth
         delete axiosInstance.defaults.headers.common['Authorization']; // Clear default auth header
         if (navigateAway && location.pathname !== '/login') {
              console.log("Navigating to login page.");
             navigate('/login');
         } else {
             console.log("Staying on current page or already on login page.");
         }
         clearInterval(refreshIntervalRef.current); // Clear any scheduled refresh
     };

    if (authLoading) {
        return <div className="vh-100 d-flex justify-content-center align-items-center"><Spinner animation="border" /></div>; // Full page loader
    }


    return (
        <AuthContext.Provider value={{ user, login, logout, loading, axiosInstance, tokens }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

// --- Notification Bell Component ---
const NotificationBell = () => {
    const { user, axiosInstance } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showOffcanvas, setShowOffcanvas] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await axiosInstance.get('/notifications/?read=false'); // Fetch only unread initially
            const unread = response.data.results || response.data;
            setNotifications(unread);
            setUnreadCount(unread.length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Set up polling
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, [user, axiosInstance]);

    const handleToggleOffcanvas = async () => {
        if (!showOffcanvas) {
            // Fetch all notifications (including read) when opening
             setLoading(true);
             try {
                 const response = await axiosInstance.get('/notifications/');
                 setNotifications(response.data.results || response.data);
                 setUnreadCount(response.data.results?.filter(n => !n.read).length || response.data?.filter(n => !n.read).length || 0);
             } catch (error) {
                 console.error("Failed to fetch all notifications:", error);
             } finally {
                 setLoading(false);
             }
        }
        setShowOffcanvas(!showOffcanvas);
    };

     const markAsRead = async (id) => {
         try {
             await axiosInstance.patch(`/notifications/${id}/mark_read/`);
             // Optimistically update UI or refetch
             setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
             setUnreadCount(prev => Math.max(0, prev - 1));
         } catch (error) {
             console.error("Failed to mark notification as read:", error);
         }
     };

     const markAllRead = async () => {
         try {
             await axiosInstance.post(`/notifications/mark-all-read/`);
             setNotifications(prev => prev.map(n => ({ ...n, read: true })));
             setUnreadCount(0);
         } catch (error) {
             console.error("Failed to mark all as read:", error);
         }
     };


    return (
        <>
            <Nav.Link onClick={handleToggleOffcanvas} className="position-relative">
                <Bell size={20} />
                {unreadCount > 0 && (
                    <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.6em', padding: '0.3em 0.5em' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
            </Nav.Link>

            <Offcanvas show={showOffcanvas} onHide={() => setShowOffcanvas(false)} placement="end" title="Notifications">
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Notifications</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    {unreadCount > 0 && <Button variant="outline-secondary" size="sm" className="mb-2 w-100" onClick={markAllRead}>Mark all as read</Button>}
                    {loading ? <Spinner animation="border" size="sm" /> :
                     notifications.length > 0 ? (
                        <ListGroup variant="flush">
                            {notifications.map(n => (
                                <ListGroup.Item key={n.id} className={`d-flex justify-content-between align-items-start ${!n.read ? 'bg-light' : ''}`}>
                                    <div>
                                        <small className="text-muted">{new Date(n.timestamp).toLocaleString()}</small>
                                        <p className="mb-0">{n.message}</p>
                                    </div>
                                    {!n.read && (
                                        <Button variant="link" size="sm" onClick={() => markAsRead(n.id)} title="Mark as read">
                                            <Check size={16} />
                                        </Button>
                                    )}
                                </ListGroup.Item>
                            ))}
                             <ListGroup.Item className="text-center mt-2">
                                <Link to="/notifications">View All Notifications</Link>
                            </ListGroup.Item>
                        </ListGroup>
                    ) : (
                        <p className="text-muted text-center">No new notifications.</p>
                    )}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};


// --- Main Layout ---
const AppNavbar = () => {
    const { user, logout } = useAuth();
    return (
        <Navbar bg="white" expand="lg" className="shadow-sm sticky-top">
            <Container>
                 {/* Updated Brand */}
                 <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center">
                    <img src="/logo.png" alt="TalentLink Logo" style={{ height: '30px', marginRight: '10px' }} />
                    TalentLink
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/projects">Find Work</Nav.Link>
                        {user?.user_type === 'client' && <Nav.Link as={Link} to="/project/new">Post a Project</Nav.Link>}
                        {/* Add Find Freelancers later? */}
                    </Nav>
                    <Nav className="align-items-center">
                        {user ? (
                            <>
                                {user && <NotificationBell />} {/* Add NotificationBell here */}
                                <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                                <Nav.Link as={Link} to="/profile" className="d-flex align-items-center">
                                    <Image src={user.profilePicture || `https://via.placeholder.com/30/007bff/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`} roundedCircle style={{ width: '30px', height: '30px', marginRight: '8px', objectFit: 'cover' }} />
                                    {user.username}
                                </Nav.Link>
                                <Button variant="outline-danger" size="sm" onClick={() => logout()} className="ms-2">
                                    <LogOut size={16} className="me-1" /> Logout
                                </Button>
                            </>
                        ) : (
                            <>
                                <Nav.Link as={Link} to="/login">Login</Nav.Link>
                                <Button as={Link} to="/register" variant="primary" size="sm">Sign Up</Button>
                            </>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};


// --- Page Components ---
const HomePage = () => { /* No changes needed */
    return (
    <>
        <div className="hero-section">
            <Container>
                <h1 className="display-4 fw-bold mb-3">Find & Hire Experts for any Job</h1>
                <p className="lead mb-4">Unlock your potential. We connect you with top freelance talent and exciting projects.</p>
                <div>
                    <Button as={Link} to="/register" variant="light" size="lg" className="me-2 fw-bold">Get Started</Button>
                    <Button as={Link} to="/projects" variant="outline-light" size="lg">Browse Projects</Button>
                </div>
            </Container>
        </div>
        <Container className="py-5">
             <Row className="text-center feature-section">
                <Col md={4} className="mb-4">
                     <Card className="h-100 shadow-sm border-0">
                         <Card.Img variant="top" src="https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Collaboration" className="feature-image" style={{ height: '200px', objectFit: 'cover' }}/>
                        <Card.Body>
                            <h3>Connect</h3>
                            <p>Join a vibrant community of professionals and businesses.</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-4">
                     <Card className="h-100 shadow-sm border-0">
                         <Card.Img variant="top" src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Teamwork" className="feature-image" style={{ height: '200px', objectFit: 'cover' }}/>
                        <Card.Body>
                            <h3>Collaborate</h3>
                            <p>Work together on innovative projects and achieve great results.</p>
                        </Card.Body>
                     </Card>
                </Col>
                <Col md={4} className="mb-4">
                     <Card className="h-100 shadow-sm border-0">
                         <Card.Img variant="top" src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Creative Work" className="feature-image" style={{ height: '200px', objectFit: 'cover' }}/>
                        <Card.Body>
                            <h3>Create</h3>
                            <p>Bring your ideas to life with the help of skilled freelancers.</p>
                         </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    </>
    )
};

const LoginPage = () => { /* No changes needed */
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading } = useAuth();
    const handleSubmit = (e) => { e.preventDefault(); login(username, password); };
    return (
        <div className="auth-page d-flex align-items-center justify-content-center">
            <Card style={{ width: '24rem' }} className="p-3 shadow-lg border-0 auth-card">
                <Card.Body>
                    <h2 className="text-center mb-4">Sign In</h2>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Username</Form.Label><Form.Control type="text" value={username} onChange={e => setUsername(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Password</Form.Label><Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required /></Form.Group>
                        <Button variant="primary" type="submit" className="w-100" disabled={loading}>{loading ? <Spinner as="span" animation="border" size="sm" /> : 'Sign In'}</Button>
                    </Form>
                     <p className="mt-3 text-center">
                        Don't have an account? <Link to="/register">Sign Up</Link>
                    </p>
                </Card.Body>
            </Card>
        </div>
    );
};

const RegisterPage = () => { /* No changes needed */
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('freelancer');
    const [loading, setLoading] = useState(false); // Added loading state
    const [error, setError] = useState(''); // Added error state
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post(`${API_URL}/register/`, { username, email, password, user_type: userType });
            alert("Registration successful! Please log in.");
            navigate('/login');
        } catch (err) {
            let errorMsg = "Registration failed. ";
            if (err.response?.data) {
                // Extract specific errors from Django REST Framework response
                 const errors = err.response.data;
                 if (errors.username) errorMsg += `Username: ${errors.username.join(' ')} `;
                 if (errors.email) errorMsg += `Email: ${errors.email.join(' ')} `;
                 if (errors.password) errorMsg += `Password: ${errors.password.join(' ')} `;
                 if (errors.non_field_errors) errorMsg += errors.non_field_errors.join(' ');
                 // Add other fields if needed
            } else {
                 errorMsg += "An unknown error occurred.";
            }
             setError(errorMsg);
            console.error("Registration error:", err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
         <div className="auth-page d-flex align-items-center justify-content-center py-5">
            <Card style={{ width: '24rem' }} className="p-3 shadow-lg border-0 auth-card">
                <Card.Body>
                    <h2 className="text-center mb-4">Create an Account</h2>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Username</Form.Label><Form.Control type="text" value={username} onChange={e => setUsername(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Password</Form.Label><Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>I am a:</Form.Label><div><Form.Check inline label="Freelancer" name="userType" type="radio" value="freelancer" checked={userType === 'freelancer'} onChange={e => setUserType(e.target.value)} /><Form.Check inline label="Client" name="userType" type="radio" value="client" checked={userType === 'client'} onChange={e => setUserType(e.target.value)} /></div></Form.Group>
                        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                             {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Sign Up'}
                        </Button>
                    </Form>
                     <p className="mt-3 text-center">
                        Already have an account? <Link to="/login">Sign In</Link>
                    </p>
                </Card.Body>
            </Card>
        </div>
    );
};

// --- Proposal Submission Modal ---
const SubmitProposalModal = ({ show, handleClose, projectId, existingProposal }) => { // Accept existingProposal
    const [coverLetter, setCoverLetter] = useState('');
    const [proposedRate, setProposedRate] = useState('');
    const [timeAvailable, setTimeAvailable] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { axiosInstance } = useAuth();
    const navigate = useNavigate();

    // Populate form if editing
    useEffect(() => {
        if (existingProposal) {
            setCoverLetter(existingProposal.cover_letter || '');
            setProposedRate(existingProposal.proposed_rate || '');
            setTimeAvailable(existingProposal.time_available || '');
            setAdditionalInfo(existingProposal.additional_info || '');
        } else {
             // Reset form if creating new
            setCoverLetter('');
            setProposedRate('');
            setTimeAvailable('');
            setAdditionalInfo('');
        }
    }, [existingProposal, show]); // Re-run when modal shows or proposal changes

    const handleSubmit = async () => {
        if (!coverLetter || !proposedRate) {
            setError('Cover letter and proposed rate are required.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const payload = {
                project: projectId,
                cover_letter: coverLetter,
                proposed_rate: proposedRate,
                time_available: timeAvailable,
                additional_info: additionalInfo,
            };
            if (existingProposal) {
                // Update existing proposal
                 await axiosInstance.put(`/proposals/${existingProposal.id}/`, payload);
                 alert('Proposal updated successfully!');
            } else {
                // Create new proposal
                 await axiosInstance.post('/proposals/', payload);
                 alert('Proposal submitted successfully!');
            }
            handleClose();
            // Maybe refresh data on the page instead of navigating away?
            // navigate('/dashboard'); // Or wherever appropriate
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.[0] || (existingProposal ? 'Failed to update proposal.' : 'Failed to submit proposal.');
            setError(errorMsg);
            console.error(errorMsg, error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                 <Modal.Title>{existingProposal ? 'Edit Proposal' : 'Submit a Proposal'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Cover Letter</Form.Label>
                        <Form.Control as="textarea" rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} required/>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Your Proposed Rate (₹)</Form.Label>
                        <Form.Control type="number" step="0.01" value={proposedRate} onChange={e => setProposedRate(e.target.value)} required/>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Time Available (e.g., hours/week, specific days)</Form.Label>
                        <Form.Control type="text" value={timeAvailable} onChange={e => setTimeAvailable(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Additional Information (Optional)</Form.Label>
                        <Form.Control as="textarea" rows={3} value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                    {loading ? <Spinner as="span" size="sm" /> : (existingProposal ? 'Update Proposal' : 'Submit Proposal')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};


const ProjectListPage = () => { /* Updated with Search */
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user, axiosInstance } = useAuth(); // Get user info
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            setError('');
            try {
                // Determine endpoint based on user type
                // Clients see their projects, Freelancers see open projects
                 const endpoint = user?.user_type === 'client' ? '/projects/' : '/projects/?status=open';
                 const params = { search: searchTerm };
                const response = await axiosInstance.get(endpoint, { params });
                setProjects(response.data.results || response.data); // Handle pagination
            } catch (error) {
                setError("Failed to fetch projects.");
                console.error("Failed to fetch projects:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search
        const debounceTimer = setTimeout(() => {
            fetchProjects();
        }, 300); // 300ms delay

        return () => clearTimeout(debounceTimer); // Clear timer on unmount or if searchTerm changes

    }, [searchTerm, user, axiosInstance]); // Re-fetch if search, user, or instance changes


    return (
        <Container className="py-5">
            <h1 className="mb-4">{user?.user_type === 'client' ? 'My Projects' : 'Open Projects'}</h1>
            <InputGroup className="mb-4">
                <Form.Control
                    placeholder="Search by title, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary"><Search size={20} /></Button>
            </InputGroup>

            {loading ? <div className="text-center"><Spinner animation="border" /></div> :
             error ? <Alert variant="danger">{error}</Alert> :
             projects.length > 0 ? (
                 <Row xs={1} md={2} lg={3} className="g-4">
                     {projects.map(project => (
                        <Col key={project.id}>
                            <Card className="h-100 shadow-sm project-card">
                                <Card.Body className="d-flex flex-column">
                                    <Card.Title>
                                        <Link to={`/project/${project.id}`} className="text-decoration-none stretched-link">
                                            {project.title}
                                        </Link>
                                    </Card.Title>
                                    <Card.Subtitle className="mb-2 text-muted">
                                         Posted by: {project.client} {user?.user_type === 'client' && <Badge bg={project.status === 'open' ? 'success' : (project.status === 'in_progress' ? 'warning' : 'secondary')} className="ms-2">{project.status.replace('_', ' ')}</Badge>}
                                    </Card.Subtitle>
                                    <Card.Text className="flex-grow-1">
                                        {project.description.length > 100 ? project.description.substring(0, 100) + '...' : project.description}
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                                        <span className="fw-bold fs-5 text-success">₹{project.budget}</span>
                                        <small className="text-muted">{new Date(project.created_at).toLocaleDateString()}</small>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                 </Row>
             ) : <Alert variant="info">No projects found.</Alert>}
        </Container>
    );
}

const ProjectDetailPage = () => { /* Updated with Edit/Delete buttons for client */
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user, axiosInstance } = useAuth();
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate(); // For navigation after delete

    useEffect(() => {
        const fetchProject = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await axiosInstance.get(`/projects/${id}/`);
                setProject(response.data);
            } catch (error) {
                 setError("Failed to fetch project details.");
                 console.error("Failed to fetch project details:", error);
            }
            finally { setLoading(false); }
        };
        fetchProject();
    }, [id, axiosInstance]);

     const handleDeleteProject = async () => {
        if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            setLoading(true); // Indicate loading state
            try {
                await axiosInstance.delete(`/projects/${id}/`);
                alert('Project deleted successfully.');
                navigate('/dashboard'); // Navigate away after deletion
            } catch (error) {
                setError('Failed to delete project.');
                console.error('Delete project error:', error.response?.data || error.message);
                setLoading(false); // Stop loading on error
            }
            // No finally setLoading(false) needed if navigating away on success
        }
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container><Alert variant="danger">{error}</Alert></Container>;
    if (!project) return <Container><Alert variant="warning">Project not found.</Alert></Container>;

    const isOwner = user?.username === project.client;

    return (
        <>
            <Container className="py-5">
                 {/* Client Owner Actions */}
                 {isOwner && (
                    <div className="mb-3 d-flex justify-content-end gap-2">
                        <Button variant="outline-secondary" size="sm" as={Link} to={`/project/${id}/edit`}>
                            <Edit size={16} className="me-1" /> Edit Project
                        </Button>
                         <Button variant="outline-danger" size="sm" onClick={handleDeleteProject} disabled={loading}>
                            <Trash2 size={16} className="me-1" /> {loading ? 'Deleting...' : 'Delete Project'}
                        </Button>
                    </div>
                )}
                <Row>
                    <Col md={8}>
                        <Card className="shadow-sm mb-4"><Card.Body>
                            <Card.Title className="display-6">{project.title}</Card.Title>
                            <Card.Subtitle className="mb-3 text-muted">
                                 Posted by {project.client} <Badge bg={project.status === 'open' ? 'success' : (project.status === 'in_progress' ? 'warning' : 'secondary')} className="ms-2">{project.status.replace('_', ' ')}</Badge>
                            </Card.Subtitle>
                            <h5 className="mt-4">Description</h5>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>
                        </Card.Body></Card>
                         {/* Consider showing proposals list here for the client */}
                    </Col>
                    <Col md={4}>
                        <Card className="shadow-sm sticky-top" style={{ top: '80px' }}> {/* Make details sticky */}
                            <ListGroup variant="flush">
                                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                    <DollarSign size={20} className="me-2 text-success"/> <strong>Budget</strong>
                                    <span className="text-success fw-bold">₹{project.budget}</span>
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                    <Clock size={20} className="me-2 text-info"/> <strong>Duration</strong>
                                    <span>{project.duration ? `${project.duration} days` : 'N/A'}</span>
                                </ListGroup.Item>
                                {project.time_slot && (
                                     <ListGroup.Item>
                                        <strong>Time Slot:</strong> <span className="text-muted">{project.time_slot}</span>
                                    </ListGroup.Item>
                                )}
                                <ListGroup.Item>
                                    <strong>Skills Required:</strong>
                                    <div className="mt-1">
                                        {project.skills_required.length > 0 ? project.skills_required.map(skill => (
                                            <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                        )) : <span className="text-muted">None specified</span>}
                                    </div>
                                </ListGroup.Item>
                            </ListGroup>
                            {/* Show Proposal button only if user is a freelancer and project is open */}
                            {user?.user_type === 'freelancer' && project.status === 'open' && (
                                <Card.Body className="text-center">
                                    <Button variant="primary" className="w-100" onClick={() => setShowProposalModal(true)}>
                                         <FileText size={16} className="me-1" /> Submit a Proposal
                                    </Button>
                                </Card.Body>
                            )}
                             {/* Link to Reviews */}
                             <Card.Footer className="text-center">
                                <Link to={`/review/${id}`}>View Reviews</Link>
                             </Card.Footer>
                        </Card>
                    </Col>
                </Row>
            </Container>
            {/* Render modal only if needed */}
            {user?.user_type === 'freelancer' && project.status === 'open' && (
                 <SubmitProposalModal show={showProposalModal} handleClose={() => setShowProposalModal(false)} projectId={id} />
            )}
        </>
    );
};


const ProjectCreatePage = () => { /* No major changes needed */
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [duration, setDuration] = useState('');
    const [skills, setSkills] = useState([]);
    const [availableSkills, setAvailableSkills] = useState([]);
    const [timeSlot, setTimeSlot] = useState('');
    const [loading, setLoading] = useState(false); // Loading state
    const [error, setError] = useState(''); // Error state
    const { axiosInstance } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const response = await axiosInstance.get('/skills/');
                setAvailableSkills(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch skills:', error);
                setError('Could not load skills list.');
            }
        };
        fetchSkills();
    }, [axiosInstance]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axiosInstance.post('/projects/', {
                title,
                description,
                budget,
                duration: duration || null, // Send null if empty
                skill_ids: skills, // Send selected skill IDs
                time_slot: timeSlot,
            });
            alert('Project created successfully!');
            navigate('/dashboard'); // Redirect after creation
        } catch (error) {
            console.error('Failed to create project:', error.response?.data || error.message);
            setError(`Failed to create project: ${JSON.stringify(error.response?.data) || 'Server error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSkillChange = (e) => {
        // Convert selected options NodeList to an array of values (IDs)
        const selectedSkills = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
        setSkills(selectedSkills);
    }

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                 <Col md={8}>
                     <h1>Create a New Project</h1>
                     <Card className="p-4 shadow-sm">
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3"><Form.Label>Project Title</Form.Label><Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} required placeholder="Describe the project requirements, scope, and deliverables..." /></Form.Group>
                            <Row>
                                <Col md={6}><Form.Group className="mb-3"><Form.Label>Budget (₹)</Form.Label><Form.Control type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required placeholder="e.g., 5000.00" /></Form.Group></Col>
                                <Col md={6}><Form.Group className="mb-3"><Form.Label>Estimated Duration (days)</Form.Label><Form.Control type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 30" /></Form.Group></Col>
                            </Row>
                            <Form.Group className="mb-3">
                                <Form.Label>Skills Required (Select multiple)</Form.Label>
                                <Form.Control as="select" multiple value={skills.map(String)} onChange={handleSkillChange} style={{ height: '150px' }}>
                                    {availableSkills.map(skill => (
                                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                                    ))}
                                </Form.Control>
                                 <Form.Text muted>Hold Ctrl (or Cmd on Mac) to select multiple skills.</Form.Text>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Preferred Time Slot (Optional)</Form.Label>
                                <Form.Control type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder="e.g., Weekdays 9am-5pm IST"/>
                            </Form.Group>
                            <Button type="submit" variant="primary" disabled={loading}>
                                 {loading ? <Spinner as="span" size="sm" /> : <><PlusCircle size={16} className="me-1"/> Post Project</>}
                            </Button>
                        </Form>
                     </Card>
                </Col>
            </Row>
        </Container>
    );
};


const DashboardPage = () => { /* Updated with Edit/Delete proposal buttons */
    const { user, axiosInstance } = useAuth();
    const [proposals, setProposals] = useState([]); // Can be proposals *received* or *sent*
    const [projects, setProjects] = useState([]); // For client's projects
    const [loadingProposals, setLoadingProposals] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

     // State for proposal edit modal
    const [showEditProposalModal, setShowEditProposalModal] = useState(false);
    const [proposalToEdit, setProposalToEdit] = useState(null);

    const fetchDashboardData = async () => {
        if (!user || !user.profileId) {
             setError("User profile not loaded.");
             setLoadingProposals(false);
             setLoadingProjects(false);
             return;
         }
        setLoadingProposals(true);
        setLoadingProjects(true);
        setError('');
        try {
            // Fetch based on user type
            if (user.user_type === 'client') {
                 // Clients: Fetch proposals for their projects & their projects list
                 const [proposalsRes, projectsRes] = await Promise.all([
                     axiosInstance.get('/proposals/'), // Queryset filtered by backend view
                     axiosInstance.get(`/projects/?client=${user.profileId}`) // Explicitly filter projects
                 ]);
                setProposals(proposalsRes.data.results || proposalsRes.data);
                setProjects(projectsRes.data.results || projectsRes.data);
            } else if (user.user_type === 'freelancer') {
                // Freelancers: Fetch proposals they submitted
                const proposalsRes = await axiosInstance.get('/proposals/'); // Queryset filtered by backend view
                setProposals(proposalsRes.data.results || proposalsRes.data);
                setLoadingProjects(false); // No projects needed for freelancer main dash
            }
        } catch (error) {
            setError("Failed to fetch dashboard data.");
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoadingProposals(false);
            setLoadingProjects(false); // Ensure this is always set
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [user, axiosInstance]); // Refetch if user changes


    const handleUpdateStatus = async (id, status) => {
        try {
            await axiosInstance.patch(`/proposals/${id}/update_status/`, { status });
            // Refresh proposals after update
            fetchDashboardData(); // Refetch all dashboard data
        } catch (error) {
            console.error('Failed to update proposal status:', error.response?.data || error.message);
            alert(`Failed to update status: ${error.response?.data?.detail || 'Server error'}`);
        }
    };

     // --- Proposal Edit/Delete Handlers ---
    const handleEditProposal = (proposal) => {
        setProposalToEdit(proposal);
        setShowEditProposalModal(true);
    };

    const handleDeleteProposal = async (id) => {
        if (window.confirm('Are you sure you want to delete this proposal?')) {
            try {
                await axiosInstance.delete(`/proposals/${id}/`);
                alert('Proposal deleted successfully.');
                fetchDashboardData(); // Refresh list
            } catch (error) {
                console.error('Failed to delete proposal:', error.response?.data || error.message);
                alert(`Failed to delete proposal: ${error.response?.data?.detail || 'Server error'}`);
            }
        }
    };

     const handleCloseEditModal = () => {
         setShowEditProposalModal(false);
         setProposalToEdit(null);
         fetchDashboardData(); // Refresh data when modal closes
     };

    // --- Project Delete Handler (for Client) ---
     const handleDeleteProject = async (id) => {
        if (window.confirm('Are you sure you want to delete this project? This will also delete associated proposals and reviews.')) {
            try {
                await axiosInstance.delete(`/projects/${id}/`);
                alert('Project deleted successfully.');
                fetchDashboardData(); // Refresh project list
            } catch (error) {
                 console.error('Failed to delete project:', error.response?.data || error.message);
                alert(`Failed to delete project: ${error.response?.data?.detail || 'Server error'}`);
            }
        }
    };

    if (!user) {
        // Handle case where user data is not yet available (e.g., during initial load/redirect)
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }


    const renderClientDashboard = () => (
        <>
            {/* Proposals Received */}
            <Card className="mb-4">
                <Card.Header as="h5">Proposals Received</Card.Header>
                {loadingProposals ? <Card.Body><Spinner size="sm"/></Card.Body> :
                 error ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                 proposals.length > 0 ? (
                    <ListGroup variant="flush">
                        {proposals.map(p => (
                            <ListGroup.Item key={p.id}>
                                <Row className="align-items-center">
                                    <Col md={8}>
                                         Proposal from <strong>{p.freelancer}</strong> for <Link to={`/project/${p.project}`}>"{p.project_title}"</Link>
                                         <br/>Rate: <strong>₹{p.proposed_rate}</strong> | Status: <Badge bg={p.status === 'pending' ? 'warning' : (p.status === 'accepted' ? 'success' : 'danger')}>{p.status}</Badge>
                                    </Col>
                                    <Col md={4} className="text-md-end mt-2 mt-md-0">
                                         {p.status === 'pending' && (
                                            <>
                                                <Button variant="success" size="sm" className="me-2 mb-1" onClick={() => handleUpdateStatus(p.id, 'accepted')} title="Accept Proposal">
                                                    <Check size={16} /> <span className="d-none d-lg-inline">Accept</span>
                                                </Button>
                                                <Button variant="danger" size="sm" className="mb-1" onClick={() => handleUpdateStatus(p.id, 'rejected')} title="Reject Proposal">
                                                    <X size={16} /> <span className="d-none d-lg-inline">Reject</span>
                                                </Button>
                                            </>
                                         )}
                                          {p.status === 'accepted' && <Badge bg="success">Accepted</Badge>}
                                          {p.status === 'rejected' && <Badge bg="danger">Rejected</Badge>}
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted">No proposals received yet.</p></Card.Body>
                }
            </Card>

            {/* My Projects */}
            <Card>
                 <Card.Header as="h5">My Posted Projects</Card.Header>
                 {loadingProjects ? <Card.Body><Spinner size="sm"/></Card.Body> :
                  error ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                  projects.length > 0 ? (
                     <ListGroup variant="flush">
                        {projects.map(proj => (
                            <ListGroup.Item key={proj.id}>
                                <Row className="align-items-center">
                                     <Col md={8}>
                                        <Link to={`/project/${proj.id}`}>{proj.title}</Link> <Badge bg={proj.status === 'open' ? 'success' : (proj.status === 'in_progress' ? 'warning' : 'secondary')} className="ms-2">{proj.status.replace('_', ' ')}</Badge>
                                    </Col>
                                     <Col md={4} className="text-md-end mt-2 mt-md-0">
                                        <Button variant="outline-secondary" size="sm" className="me-2 mb-1" as={Link} to={`/project/${proj.id}/edit`} title="Edit Project">
                                             <Edit size={16} /> <span className="d-none d-lg-inline">Edit</span>
                                        </Button>
                                         <Button variant="outline-danger" size="sm" className="mb-1" onClick={() => handleDeleteProject(proj.id)} title="Delete Project">
                                             <Trash2 size={16} /> <span className="d-none d-lg-inline">Delete</span>
                                        </Button>
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted">You haven't posted any projects yet.</p></Card.Body>
                }
            </Card>
        </>
    );

    const renderFreelancerDashboard = () => {
        const getStatusBadge = (status) => {
            switch (status) {
                case 'accepted': return <Badge bg="success">Accepted</Badge>;
                case 'rejected': return <Badge bg="danger">Rejected</Badge>;
                default: return <Badge bg="warning">Pending</Badge>;
            }
        };

        return (
            <Card>
                <Card.Header as="h5">My Submitted Proposals</Card.Header>
                 {loadingProposals ? <Card.Body><Spinner size="sm"/></Card.Body> :
                  error ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                 proposals.length > 0 ? (
                    <ListGroup variant="flush">
                        {proposals.map(p => (
                            <ListGroup.Item key={p.id}>
                                 <Row className="align-items-center">
                                    <Col md={8}>
                                        Proposal for <Link to={`/project/${p.project}`}>"{p.project_title}"</Link>
                                    </Col>
                                     <Col md={2} className="text-md-center mt-2 mt-md-0">
                                         {getStatusBadge(p.status)}
                                    </Col>
                                    <Col md={2} className="text-md-end mt-2 mt-md-0">
                                        {/* Allow edit/delete only if pending */}
                                        {p.status === 'pending' && (
                                            <>
                                                <Button variant="outline-secondary" size="sm" className="me-2 mb-1" onClick={() => handleEditProposal(p)} title="Edit Proposal">
                                                    <Edit size={16} />
                                                </Button>
                                                <Button variant="outline-danger" size="sm" className="mb-1" onClick={() => handleDeleteProposal(p.id)} title="Delete Proposal">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted">You have not submitted any proposals.</p></Card.Body>
                }
            </Card>
        );
    };

    return (
        <Container className="py-5">
            <h1 className="mb-4">Dashboard</h1>
            <Row>
                {/* Sidebar Navigation */}
                <Col md={3} className="mb-4 mb-md-0">
                    <Card className="shadow-sm">
                        <Card.Header>Navigation</Card.Header>
                        <ListGroup variant="flush">
                             <ListGroup.Item action as={Link} to="/profile"><User size={16} className="me-2"/> My Profile</ListGroup.Item>
                             <ListGroup.Item action as={Link} to="/contracts"><FileText size={16} className="me-2"/> My Contracts</ListGroup.Item>
                             <ListGroup.Item action as={Link} to="/messages"><MessageSquare size={16} className="me-2"/> Messages</ListGroup.Item>
                             <ListGroup.Item action as={Link} to="/notifications"><Bell size={16} className="me-2"/> Notifications</ListGroup.Item>
                             {/* Add more links as needed */}
                        </ListGroup>
                    </Card>
                </Col>

                {/* Main Content Area */}
                <Col md={9}>
                    {/* Welcome Card */}
                    <Card className="shadow-sm mb-4">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-2">
                                 <Image src={user.profilePicture || `https://via.placeholder.com/50/007bff/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`} roundedCircle style={{ width: '50px', height: '50px', marginRight: '15px', objectFit: 'cover' }} />
                                <div>
                                     <Card.Title className="fs-4 mb-0">Welcome back, {user.username}!</Card.Title>
                                     <Card.Text className="text-muted">You are logged in as a <Badge bg="info">{user.user_type}</Badge></Card.Text>
                                </div>
                            </div>
                            {user.user_type === 'client' && <Button as={Link} to="/project/new" variant="primary"><PlusCircle size={16} className="me-1"/> Post New Project</Button>}
                        </Card.Body>
                    </Card>

                    {/* Dynamic Content based on User Type */}
                     {user.user_type === 'client' ? renderClientDashboard() : renderFreelancerDashboard()}
                </Col>
            </Row>
             {/* Edit Proposal Modal */}
             <SubmitProposalModal
                show={showEditProposalModal}
                handleClose={handleCloseEditModal}
                projectId={proposalToEdit?.project} // Pass project ID
                existingProposal={proposalToEdit}
            />
        </Container>
    );
}

// --- Main App Component ---
function App() {
    return (
         // Wrap with BrowserRouter if it's not already done in main.jsx
        <AuthProvider>
            <div className="d-flex flex-column" style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
                <AppNavbar />
                <main className="flex-grow-1">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/projects" element={<ProjectListPage />} /> {/* List accessible to all logged-in */}
                        <Route path="/project/:id" element={<ProjectDetailPage />} /> {/* Detail accessible to all logged-in */}
                         <Route path="/review/:projectId" element={<ReviewPage />} /> {/* Reviews accessible */}


                        {/* Protected Routes (Implicitly handled by AuthProvider context checks within components) */}
                        <Route path="/project/new" element={<ProjectCreatePage />} />
                        <Route path="/project/:id/edit" element={<ProjectEditPage />} /> {/* New Edit Route */}
                        <Route path="/proposal/:id/edit" element={<ProposalEditPage />} /> {/* New Edit Route */}
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/contracts" element={<ContractsPage />} />
                        <Route path="/messages" element={<MessagingPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} /> {/* New Notifications Route */}


                        {/* Add 404 Not Found Route later */}
                    </Routes>
                </main>
                 {/* Optional Footer */}
                 <footer className="bg-light text-center text-muted py-3 mt-auto">
                    <Container>
                         &copy; {new Date().getFullYear()} TalentLink. All rights reserved.
                    </Container>
                </footer>
            </div>
        </AuthProvider>
    );
}

export default App; // Assuming BrowserRouter is in main.jsx
//Need to wrap AuthProvider with BrowserRouter if not done elsewhere
// For standalone testing:
 /*const RootApp = () => (
     <BrowserRouter>
         <App />
     </BrowserRouter>
 );

 export default RootApp;*/