import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import './index.css'; 
import { Navbar, Nav, Container, Button, Form, Card, Row, Col, Alert, Spinner, Badge, ListGroup, Modal, InputGroup, Image, Dropdown, Offcanvas } from 'react-bootstrap';
import 'react-quill/dist/quill.snow.css';
import './pages/ProjectEditPage.css'; 
import { Briefcase, LogOut, User, DollarSign, Clock, PlusCircle, Search, Check, X, MessageSquare, Award, FileText, Bell, Edit, Trash2, Link as LinkIconLucide, Image as ImageIcon, Send, UserPlus, Star, Activity, BarChart3, Filter, TrendingUp, Bookmark, BookmarkCheck, Shield, Trophy, Zap, Wallet as WalletIcon } from 'lucide-react';


import ProfilePage from './pages/ProfilePage';
import ContractsPage from './pages/ContractsPage';
import ReviewPage from './pages/ReviewPage';
import ProjectEditPage from './pages/ProjectEditPage';
import NotificationsPage from './pages/NotificationsPage';
import WalletPage from './pages/WalletPage';
import MilestonesPage from './pages/MilestonesPage';
import InvoicesPage from './pages/InvoicesPage';
import HomePage from './components/HomePage';
import './components/HomePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'; 
const API_URL = `${API_BASE_URL}/api`; 

const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 5000, 
    headers: {
        'Content-Type': 'application/json',
    }
});
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);
    const [tokens, setTokens] = useState(() => localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null);
    const [loading, setLoading] = useState(false); 
    const [authLoading, setAuthLoading] = useState(true); 
    const navigate = useNavigate();
    const location = useLocation(); 
    const refreshIntervalRef = useRef();

    useEffect(() => {
        const reqInterceptor = axiosInstance.interceptors.request.use(config => {
            const currentTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
            if (currentTokens?.access) {
                config.headers.Authorization = `Bearer ${currentTokens.access}`;
            }
            if (config.data instanceof FormData) {
                 delete config.headers['Content-Type'];
            } else {
                 config.headers['Content-Type'] = 'application/json';
            }
            return config;
        }, error => Promise.reject(error));
        setAuthLoading(false); 
        return () => {
            axiosInstance.interceptors.request.eject(reqInterceptor);
        };
    }, []);

    useEffect(() => {
        const resInterceptor = axiosInstance.interceptors.response.use(
            response => response,
            async error => {
                const originalRequest = error.config;
                const currentTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
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
                        return axiosInstance(originalRequest);
                    } catch (refreshError) {
                        console.error("Token refresh failed:", refreshError?.response?.data || refreshError?.message || refreshError);
                        logout(false); 
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axiosInstance.interceptors.response.eject(resInterceptor);
        };
    }, [tokens]);

    const login = async (username, password) => {
        setLoading(true);
        try {
            console.log(`Attempting login to: ${API_URL}/token/`);
            const tokenResponse = await axios.post(`${API_URL}/token/`, { username, password });
            const newTokens = tokenResponse.data;
            
            if (!newTokens || !newTokens.access) {
                throw new Error('Invalid response from server: No access token received');
            }
            
            setTokens(newTokens);
            localStorage.setItem('authTokens', JSON.stringify(newTokens));
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access}`;
             const profileResponse = await axiosInstance.get(`/profiles/`);
            const profileData = profileResponse.data.results || profileResponse.data;
            const userProfile = Array.isArray(profileData)
                ? profileData.find(p => p.user === username)
                : (profileData && profileData.user === username ? profileData : null);
            if (userProfile) {
                 const getFullImageUrl = (url) => {
                     if (!url) return null;
                     if (url.startsWith('http')) return url;
                     return `${API_BASE_URL}${url}`; 
                 };
                const fullProfilePicUrl = getFullImageUrl(userProfile.profile_picture);
                const userDetails = {
                    username: userProfile.user,
                    user_type: userProfile.user_type,
                    profileId: userProfile.id,
                    profilePicture: fullProfilePicUrl 
                 };
                setUser(userDetails);
                localStorage.setItem('user', JSON.stringify(userDetails));
                 console.log("Login successful, navigating to dashboard.");
                navigate('/dashboard');
            } else {
                 console.error("Profile not found for user:", username, "API response:", profileResponse.data);
                 alert("Login succeeded but failed to retrieve user profile details.");
                 logout(false);
            }

        } catch (error) {
            console.error("Login failed:", error);
            let errorMessage = 'Invalid credentials or server error.';
            
            if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
                errorMessage = `Cannot connect to backend server. Please ensure the Django server is running at ${API_BASE_URL}`;
            } else if (error.response?.status === 401) {
                errorMessage = 'Invalid username or password. Please check your credentials.';
            } else if (error.response?.status === 404) {
                errorMessage = `API endpoint not found. Please check if backend is running at ${API_BASE_URL}`;
            } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.data) {
                errorMessage = JSON.stringify(error.response.data);
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            alert(`Login failed: ${errorMessage}`);
            logout(false); 
        } finally {
            setLoading(false);
        }
    };

     const logout = (navigateAway = true) => {
         console.log("Logging out...");
         setUser(null);
         setTokens(null);
         localStorage.clear(); 
         delete axiosInstance.defaults.headers.common['Authorization']; 
         if (navigateAway && location.pathname !== '/login') {
              console.log("Navigating to login page.");
             navigate('/login');
         } else {
             console.log("Staying on current page or already on login page.");
         }
         clearInterval(refreshIntervalRef.current); 
     };
      const updateUserContext = (updates) => {
          setUser(prevUser => {
              if (!prevUser) return null;
               let finalUpdates = { ...updates };
               if (updates.profilePicture) {
                   const getFullImageUrl = (url) => {
                       if (!url) return null;
                       if (url.startsWith('http')) return url;
                       return `${API_BASE_URL}${url}`;
                   };
                   finalUpdates.profilePicture = getFullImageUrl(updates.profilePicture);
               }

              const updatedUser = { ...prevUser, ...finalUpdates };
              localStorage.setItem('user', JSON.stringify(updatedUser)); 
              return updatedUser;
          });
       };


    if (authLoading) {
        return <div className="vh-100 d-flex justify-content-center align-items-center"><Spinner animation="border" /></div>; 
    }
    return (
        <AuthContext.Provider value={{ user, login, logout, loading, axiosInstance, tokens, updateUserContext }}>
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
    const audioRef = useRef(null);
    useEffect(() => {
        const unlockAudio = () => {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play().catch(() => {}); 
                audioRef.current.pause();
                audioRef.current.currentTime = 0; 
            }
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, [audioRef]); 

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const response = await axiosInstance.get('/notifications/?read=false');
            const unread = response.data.results || response.data;
            const count = Array.isArray(unread) ? unread.length : (response.data.count !== undefined ? response.data.count : 0);
            if (count > unreadCount && audioRef.current) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Audio play failed (user may need to interact first):", error);
                    });
                }
            }
            
            if (count !== unreadCount) {
                setUnreadCount(count);
            }
        } catch (error) {
            console.error("Failed to fetch unread notifications count:", error);
        }
    };
    useEffect(() => {
        fetchNotifications(); 
        const interval = setInterval(fetchNotifications, 30000); 
        return () => clearInterval(interval);
    }, [user, axiosInstance]);


    const handleToggleOffcanvas = async () => {
        const currentlyShowing = showOffcanvas;
        setShowOffcanvas(!currentlyShowing); 

        if (!currentlyShowing) { 
            setLoading(true); 
            try {
                const response = await axiosInstance.get('/notifications/');
                const allNotifications = response.data.results || response.data;
                setNotifications(allNotifications);
                 setUnreadCount(allNotifications.filter(n => !n.read).length);
            } catch (error) {
                console.error("Failed to fetch all notifications:", error);
                setNotifications([]); 
            } finally {
                setLoading(false);
            }
        }
    };

     const markAsRead = async (id) => {
         try {
             await axiosInstance.patch(`/notifications/${id}/mark_read/`); 
             setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
             setUnreadCount(prev => Math.max(0, prev - 1)); 
         } catch (error) {
             console.error("Failed to mark notification as read:", error);
             alert("Could not mark notification as read."); 
         }
     };

     const markAllRead = async () => {
         try {
             await axiosInstance.post(`/notifications/mark-all-read/`); 
             setNotifications(prev => prev.map(n => ({ ...n, read: true })));
             setUnreadCount(0); 
         } catch (error) {
             console.error("Failed to mark all as read:", error);
              alert("Could not mark all notifications as read."); 
         }
     };


    return (
        <>
            <audio ref={audioRef} src="/notification.wav" preload="auto" style={{ display: 'none' }} />
            <Nav.Link onClick={handleToggleOffcanvas} className="position-relative">
                <Bell size={20} />
                {unreadCount > 0 && (
                    <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.6em', padding: '0.3em 0.5em' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                        <span className="visually-hidden">unread notifications</span>
                    </Badge>
                )}
            </Nav.Link>

            <Offcanvas show={showOffcanvas} onHide={() => setShowOffcanvas(false)} placement="end">
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Notifications</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                     {notifications.some(n => !n.read) && <Button variant="outline-secondary" size="sm" className="mb-2 w-100" onClick={markAllRead}>Mark all as read</Button>}
                    {loading ? <div className="text-center"><Spinner animation="border" size="sm" /></div> :
                     notifications.length > 0 ? (
                        <ListGroup variant="flush">
                            {notifications.map(n => (
                                <ListGroup.Item key={n.id} className={`d-flex justify-content-between align-items-start ${!n.read ? 'bg-light' : ''}`} style={{ borderBottom: '1px solid #eee' }}>
                                    <div>
                                        <small className="text-muted">{new Date(n.timestamp).toLocaleString()}</small>
                                        <p className="mb-0">{n.message}</p>
                                    </div>
                                    {!n.read && (
                                        <Button variant="link" size="sm" onClick={() => markAsRead(n.id)} title="Mark as read" className="p-0">
                                            <Check size={16} />
                                        </Button>
                                    )}
                                </ListGroup.Item>
                            ))}
                             <ListGroup.Item className="text-center mt-2 border-0">
                                <Link to="/notifications" onClick={() => setShowOffcanvas(false)}>View All Notifications</Link>
                            </ListGroup.Item>
                        </ListGroup>
                    ) : (
                        <p className="text-muted text-center mt-3">No notifications.</p>
                    )}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};

// --- Main Layout ---
const AppNavbar = () => {
    const { user, logout } = useAuth();

     
     const getFullImageUrl = (url) => {
         if (!url) return null;
         if (/^https?:\/\//i.test(url)) {
             return url;
         }
          if (url.startsWith('blob:')) {
             return url;
         }
         return `${API_BASE_URL}${url}`;
     };

     const profilePicUrl = getFullImageUrl(user?.profilePicture) || `https://via.placeholder.com/30/ced4da/6c757d?text=${user?.username?.charAt(0).toUpperCase() || '?'}`; // Placeholder with grey colors


    return (
        <Navbar bg="white" expand="lg" className="shadow-sm sticky-top">
            <Container>
                 <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center">
                    <img src="/logo.png" alt="TalentLink Logo" style={{ height: '30px', marginRight: '10px' }} />
                    TalentLink
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/projects">Find Work</Nav.Link>
                        {user?.user_type === 'client' && <Nav.Link as={Link} to="/project/new">Post a Project</Nav.Link>}
                        {user && (
                            <>
                                <Nav.Link as={Link} to="/saved-projects"><Bookmark size={16} className="me-1" />Saved</Nav.Link>
                                <Nav.Link as={Link} to="/activities"><Activity size={16} className="me-1" />Activity</Nav.Link>
                                {user.user_type === 'client' && <Nav.Link as={Link} to="/analytics"><BarChart3 size={16} className="me-1" />Analytics</Nav.Link>}
                            </>
                        )}
                    </Nav>
                    <Nav className="align-items-center">
                        {user ? (
                            <>
                                {user && <NotificationBell />} {/* Add NotificationBell here */}
                                <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                                <Nav.Link as={Link} to="/profile" className="d-flex align-items-center">
                                    <Image src={profilePicUrl} roundedCircle style={{ width: '30px', height: '30px', marginRight: '8px', objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                    {user.username}
                                </Nav.Link>
                                <Button variant="outline-danger" size="sm" onClick={() => logout(true)} className="ms-2"> {/* Ensure navigateAway is true */}
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

const LoginPage = () => {
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

const RegisterPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('freelancer');
    const [loading, setLoading] = useState(false); 
    const [error, setError] = useState(''); 
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
                 const errors = err.response.data;
                 errorMsg += Object.entries(errors)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                    .join('; ');
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
                        <Form.Group className="mb-3"><Form.Label>I am a:</Form.Label><div><Form.Check inline label="Freelancer" name="userType" type="radio" value="freelancer" checked={userType === 'freelancer'} onChange={e => setUserType(e.target.value)} id="radio-freelancer"/><Form.Check inline label="Client" name="userType" type="radio" value="client" checked={userType === 'client'} onChange={e => setUserType(e.target.value)} id="radio-client" /></div></Form.Group>
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


const SubmitProposalModal = ({ show, handleClose, projectId, existingProposal, onProposalUpdate }) => {
    const [coverLetter, setCoverLetter] = useState('');
    const [proposedRate, setProposedRate] = useState('');
    const [timeAvailable, setTimeAvailable] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { axiosInstance } = useAuth();
    useEffect(() => {
        if (show) { 
            if (existingProposal) {
                setCoverLetter(existingProposal.cover_letter || '');
                setProposedRate(existingProposal.proposed_rate || '');
                setTimeAvailable(existingProposal.time_available || '');
                setAdditionalInfo(existingProposal.additional_info || '');
            } else {
                
                setCoverLetter('');
                setProposedRate('');
                setTimeAvailable('');
                setAdditionalInfo('');
            }
            setError(''); 
        }
    }, [existingProposal, show]); 

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
                 await axiosInstance.patch(`/proposals/${existingProposal.id}/`, payload);
                 alert('Proposal updated successfully!');
            } else {
                 await axiosInstance.post('/proposals/', payload);
                 alert('Proposal submitted successfully!');
            }
            if(onProposalUpdate) onProposalUpdate(); 
            handleClose(); 
        } catch (error) {
            const errorData = error.response?.data;
            let errorMsg = existingProposal ? 'Failed to update proposal.' : 'Failed to submit proposal.';
            if (typeof errorData === 'string') {
                errorMsg = errorData;
            } else if (errorData) {
                const messages = Object.entries(errorData)
                    .map(([field, fieldErrors]) => `${field}: ${Array.isArray(fieldErrors) ? fieldErrors.join(' ') : fieldErrors}`)
                    .join('; ');
                if (messages) {
                    errorMsg = messages;
                } else if (errorData.detail) {
                    errorMsg = errorData.detail;
                }
            }
            setError(errorMsg);
            console.error('Proposal Submit/Update Error:', errorMsg, error.response?.data || error.message);
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
                        <Form.Label>Cover Letter *</Form.Label>
                        <Form.Control as="textarea" rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} required/>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Your Proposed Rate (₹) *</Form.Label>
                        <Form.Control type="number" step="0.01" value={proposedRate} onChange={e => setProposedRate(e.target.value)} required placeholder="e.g., 3000.00"/>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Time Available (Optional)</Form.Label>
                        <Form.Control type="text" value={timeAvailable} onChange={e => setTimeAvailable(e.target.value)} placeholder="e.g., 20 hrs/week, Mon-Fri evenings IST" />
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


const ProjectListPage = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({});
    const [showFilters, setShowFilters] = useState(false);
    const { user, axiosInstance } = useAuth();
    const [error, setError] = useState('');

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const endpoint = '/projects/';
            const params = { ...(searchTerm ? { search: searchTerm } : {}) };
            if (filters.minBudget) params.budget__gte = filters.minBudget;
            if (filters.maxBudget) params.budget__lte = filters.maxBudget;
            if (filters.status) params.status = filters.status;
            if (filters.sortBy) params.ordering = filters.sortBy;
            const response = await axiosInstance.get(endpoint, { params });
            setProjects(response.data.results || response.data);
        } catch (error) {
            setError("Failed to fetch projects.");
            console.error("Failed to fetch projects:", error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filters, axiosInstance]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchProjects();
        }, 300);
        return () => clearTimeout(debounceTimer);
    }, [fetchProjects]);

    const handleSaveProject = async (projectId, isSaved) => {
        if (!user) return;
            try {
                if (isSaved) {
                    const savedProjectsRes = await axiosInstance.get('/saved-projects/');
                    const savedProjects = savedProjectsRes.data.results || savedProjectsRes.data;
                    const saved = savedProjects.find(sp => {
                        const projId = typeof sp.project === 'object' ? sp.project.id : sp.project;
                        return projId === projectId;
                    });
                    if (saved) {
                        await axiosInstance.delete(`/saved-projects/${saved.id}/`);
                    }
                } else {
                    await axiosInstance.post('/saved-projects/', { project_id: projectId });
                }
                fetchProjects(); 
            } catch (err) {
                alert('Failed to save/unsave project.');
                console.error(err);
            }
    };

    return (
        <Container className="py-5 animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="gradient-text">Browse Projects</h1>
                <Button variant="outline-primary" onClick={() => setShowFilters(!showFilters)}>
                    <Filter className="me-2" size={16} /> {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
            </div>
            {showFilters && <AdvancedFilters onFilterChange={setFilters} />}
            <InputGroup className="mb-4">
                <Form.Control
                    placeholder="Search by title, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary" id="button-search"><Search size={20} /></Button>
            </InputGroup>

            {loading ? <div className="text-center"><Spinner animation="border" /></div> :
             error ? <Alert variant="danger">{error}</Alert> :
             projects.length > 0 ? (
                 <Row xs={1} md={2} lg={3} className="g-4">
                     {projects.map(project => (
                        <Col key={project.id}>
                            <Card className="h-100 shadow-sm project-card">
                                <Card.Body className="d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <Card.Title className="flex-grow-1">
                                            <Link to={`/project/${project.id}`} className="text-decoration-none">
                                                {project.title}
                                            </Link>
                                        </Card.Title>
                                        {user?.user_type === 'freelancer' && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="p-0 ms-2"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleSaveProject(project.id, project.is_saved);
                                                }}
                                                title={project.is_saved ? 'Unsave project' : 'Save project'}
                                            >
                                                {project.is_saved ? <BookmarkCheck size={20} className="text-primary" /> : <Bookmark size={20} />}
                                            </Button>
                                        )}
                                    </div>
                                    <Card.Subtitle className="mb-2 text-muted">
                                         Client: {project.client} <Badge bg={project.status === 'active' ? 'success' : (project.status === 'in_progress' ? 'warning' : project.status === 'completed' ? 'primary' : 'secondary')} className="ms-2">{project.status.replace('_', ' ')}</Badge>
                                    </Card.Subtitle>
                                    <Card.Text className="flex-grow-1">
                                        {project.description.length > 100 ? project.description.substring(0, 100) + '...' : project.description}
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                                        <span className="fw-bold fs-5 text-success">₹{project.budget}</span>
                                        <small className="text-muted">{new Date(project.created_at).toLocaleDateString()}</small>
                                    </div>
                                    {project.analytics && (
                                        <div className="mt-2 pt-2 border-top">
                                            <small className="text-muted">
                                                <TrendingUp size={14} className="me-1" /> {project.analytics.total_views} views • {project.analytics.proposals_count} proposals
                                            </small>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                 </Row>
             ) : <Alert variant="info">No projects found matching your criteria.</Alert>}
        </Container>
    );
};

const ProjectDetailPage = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user, axiosInstance } = useAuth();
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate(); 

    useEffect(() => {
        const fetchProject = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await axiosInstance.get(`/projects/${id}/`);
                setProject(response.data);
            } catch (error) {
                 setError("Failed to fetch project details or you might not have permission.");
                 console.error("Failed to fetch project details:", error?.response?.data || error?.message || error);
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
    if (error && !project) return <Container><Alert variant="danger">{error}</Alert></Container>; // Show error only if project failed to load
    if (!project) return <Container><Alert variant="warning">Project not found or access denied.</Alert></Container>;

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
                {/* Display specific fetch error related to this page if project loaded but error exists */}
                {error && <Alert variant="danger">{error}</Alert>}
                <Row>
                    <Col md={8}>
                        <Card className="shadow-sm mb-4"><Card.Body>
                            <Card.Title className="display-6">{project.title}</Card.Title>
                            <Card.Subtitle className="mb-3 text-muted d-flex align-items-center justify-content-between">
                                <div>
                                    Posted by {project.client} <Badge bg={project.status === 'active' ? 'success' : (project.status === 'in_progress' ? 'warning' : project.status === 'completed' ? 'primary' : 'secondary')} className="ms-2">{project.status.replace('_', ' ')}</Badge>
                                </div>
                                {isOwner && (
                                    <Dropdown>
                                        <Dropdown.Toggle variant="outline-primary" size="sm" id="status-dropdown">
                                            Update Status
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu>
                                            <Dropdown.Item onClick={async () => {
                                                try {
                                                    await axiosInstance.patch(`/projects/${id}/update-status/`, { status: 'active' });
                                                    const response = await axiosInstance.get(`/projects/${id}/`);
                                                    setProject(response.data);
                                                } catch (err) {
                                                    alert('Failed to update status.');
                                                }
                                            }}>Set as Active</Dropdown.Item>
                                            <Dropdown.Item onClick={async () => {
                                                try {
                                                    await axiosInstance.patch(`/projects/${id}/update-status/`, { status: 'in_progress' });
                                                    const response = await axiosInstance.get(`/projects/${id}/`);
                                                    setProject(response.data);
                                                } catch (err) {
                                                    alert('Failed to update status.');
                                                }
                                            }}>Set as In Progress</Dropdown.Item>
                                            <Dropdown.Item onClick={async () => {
                                                try {
                                                    await axiosInstance.patch(`/projects/${id}/update-status/`, { status: 'completed' });
                                                    const response = await axiosInstance.get(`/projects/${id}/`);
                                                    setProject(response.data);
                                                } catch (err) {
                                                    alert('Failed to update status.');
                                                }
                                            }}>Mark as Completed</Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                )}
                            </Card.Subtitle>
                            <h5 className="mt-4">Description</h5>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>
                        </Card.Body></Card>
                         {/* TODO: Consider showing proposals list here for the client owner */}
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
                                        {project.skills_required?.length > 0 ? project.skills_required.map(skill => (
                                            <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                        )) : <span className="text-muted">None specified</span>}
                                    </div>
                                </ListGroup.Item>
                            </ListGroup>
                            {/* Show Proposal button only if user is a freelancer and project is active */}
                            {user?.user_type === 'freelancer' && project.status === 'active' && (
                                <Card.Body className="text-center">
                                    <Button variant="primary" className="w-100 mb-2" onClick={() => setShowProposalModal(true)}>
                                         <FileText size={16} className="me-1" /> Submit a Proposal
                                    </Button>
                                    <Button 
                                        variant={project.is_saved ? "outline-danger" : "outline-primary"} 
                                        className="w-100" 
                                        onClick={async () => {
                                            try {
                                                if (project.is_saved) {
                                                    const savedProjectsRes = await axiosInstance.get('/saved-projects/');
                                                    const savedProjects = savedProjectsRes.data.results || savedProjectsRes.data;
                                                    const saved = savedProjects.find(sp => {
                                                        const projId = typeof sp.project === 'object' ? sp.project.id : sp.project;
                                                        return projId === parseInt(id);
                                                    });
                                                    if (saved) {
                                                        await axiosInstance.delete(`/saved-projects/${saved.id}/`);
                                                    }
                                                } else {
                                                    await axiosInstance.post('/saved-projects/', { project_id: id });
                                                }
                                                // Refresh project data
                                                const response = await axiosInstance.get(`/projects/${id}/`);
                                                setProject(response.data);
                                            } catch (err) {
                                                alert('Failed to save/unsave project.');
                                                console.error(err);
                                            }
                                        }}
                                    >
                                        {project.is_saved ? <><BookmarkCheck size={16} className="me-1" /> Unsave Project</> : <><Bookmark size={16} className="me-1" /> Save Project</>}
                                    </Button>
                                </Card.Body>
                            )}
                             {/* Link to Reviews and Milestones */}
                             <Card.Footer className="text-center">
                                <div className="d-flex justify-content-center gap-3">
                                    <Link to={`/review/${id}`}>View Reviews</Link>
                                    {project.status === 'in_progress' && (
                                        <Link to={`/project/${id}/milestones`}>View Milestones</Link>
                                    )}
                                </div>
                             </Card.Footer>
                        </Card>
                    </Col>
                </Row>
            </Container>
            {/* Render modal only if needed */}
            {user?.user_type === 'freelancer' && project.status === 'active' && (
                 <SubmitProposalModal show={showProposalModal} handleClose={() => setShowProposalModal(false)} projectId={id} />
            )}
        </>
    );
};


const ProjectCreatePage = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [budget, setBudget] = useState('');
    const [duration, setDuration] = useState('');
    const [skills, setSkills] = useState([]); // Stores selected skill IDs
    const [availableSkills, setAvailableSkills] = useState([]);
    const [timeSlot, setTimeSlot] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false); // Loading state
    const [error, setError] = useState(''); // Error state
    // New state for typed skill names
    const [newSkillNames, setNewSkillNames] = useState([]);
    const [newSkillInput, setNewSkillInput] = useState('');
    // Image upload state
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
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
        setTimeout(() => setShowForm(true), 100); // Animate form in
    }, [axiosInstance]);

    const handleCreateProject = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('budget', budget);
            formData.append('duration', duration || '');
            skills.forEach(id => formData.append('skill_ids', id));
            newSkillNames.forEach(name => formData.append('new_skill_names', name));
            formData.append('time_slot', timeSlot);
            formData.append('deadline', deadline || '');
            if (imageFile) {
                formData.append('image', imageFile);
            }
            await axiosInstance.post('/projects/', formData);
            alert('Project created successfully!');
            navigate('/dashboard');
        } catch (error) {
            const errorData = error.response?.data;
            let errorMsg = 'Failed to create project.';
            if (errorData) {
                errorMsg += ` ${JSON.stringify(errorData)}`;
            }
            console.error('Failed to create project:', errorData || error.message);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-5 animate-fade-in" style={{ minHeight: '80vh' }}>
            <Row className="justify-content-center">
                <Col md={8} lg={7}>
                    <Card className="shadow-lg border-0">
                        <Card.Body>
                            <h2 className="mb-4 text-center gradient-text">Post a New Project</h2>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Form onSubmit={e => { e.preventDefault(); handleCreateProject(); }}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Title *</Form.Label>
                                    <Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Project Title" />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Description *</Form.Label>
                                    <Form.Control as="textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} required placeholder="Describe your project..." />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Budget (9) *</Form.Label>
                                    <Form.Control type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required placeholder="e.g., 5000.00" />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Duration (days)</Form.Label>
                                    <Form.Control type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 30" />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Time Slot (Optional)</Form.Label>
                                    <Form.Control type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder="e.g., Mon-Fri, 10am-6pm" />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Deadline (Optional)</Form.Label>
                                    <Form.Control type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Skills Required</Form.Label>
                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                        {availableSkills.map(skill => (
                                            <Badge
                                                key={skill.id}
                                                pill
                                                bg={skills.includes(skill.id) ? "primary" : "light"}
                                                text={skills.includes(skill.id) ? "light" : "dark"}
                                                style={{ cursor: "pointer", border: "1px solid #dee2e6" }}
                                                onClick={() => setSkills(skills.includes(skill.id) ? skills.filter(id => id !== skill.id) : [...skills, skill.id])}
                                            >
                                                {skill.name}
                                            </Badge>
                                        ))}
                                    </div>
                                    <Form.Text className="text-muted">Click to select/unselect skills.</Form.Text>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Type New Skills</Form.Label>
                                    <InputGroup>
                                        <Form.Control
                                            type="text"
                                            value={newSkillInput}
                                            onChange={e => setNewSkillInput(e.target.value)}
                                            placeholder="Type a skill and press Enter"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newSkillInput.trim()) {
                                                    setNewSkillNames([...newSkillNames, newSkillInput.trim()]);
                                                    setNewSkillInput('');
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="outline-primary"
                                            onClick={() => {
                                                if (newSkillInput.trim()) {
                                                    setNewSkillNames([...newSkillNames, newSkillInput.trim()]);
                                                    setNewSkillInput('');
                                                }
                                            }}
                                        >Add</Button>
                                    </InputGroup>
                                    <div className="mt-2">
                                        {newSkillNames.map((skill, idx) => (
                                            <Badge key={idx} pill bg="info" text="light" className="me-1 mb-1">
                                                {skill}
                                                <span
                                                    style={{ cursor: 'pointer', marginLeft: 6 }}
                                                    onClick={() => setNewSkillNames(newSkillNames.filter((_, i) => i !== idx))}
                                                >
                                                    &times;
                                                </span>
                                            </Badge>
                                        ))}
                                    </div>
                                    <Form.Text className="text-muted">You can add skills not listed above.</Form.Text>
                                </Form.Group>
                                {/* Project Image Upload */}
                                <Form.Group className="mb-3">
                                    <Form.Label>Project Image (Optional)</Form.Label>
                                    <Form.Control type="file" accept="image/*" onChange={e => {
                                        const file = e.target.files[0];
                                        setImageFile(file);
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => setImagePreview(reader.result);
                                            reader.readAsDataURL(file);
                                        } else {
                                            setImagePreview(null);
                                        }
                                    }} />
                                    {imagePreview && (
                                        <div className="mt-2"><img src={imagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '150px' }} /></div>
                                    )}
                                </Form.Group>
                                <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                                    {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Post Project'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}


const DashboardPage = () => {
    const { user, axiosInstance } = useAuth();
    const [proposals, setProposals] = useState([]); // Can be proposals *received* or *sent*
    const [projects, setProjects] = useState([]); // For client's projects
    const [loadingProposals, setLoadingProposals] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [error, setError] = useState(''); // General dashboard error
    const [updateError, setUpdateError] = useState(''); // Specific error for status updates
    const navigate = useNavigate();

     // State for proposal edit modal
    const [showEditProposalModal, setShowEditProposalModal] = useState(false);
    const [proposalToEdit, setProposalToEdit] = useState(null);

    // Function to construct full image URL
     const getFullImageUrl = (url) => {
         if (!url) return null;
         if (url.startsWith('http') || url.startsWith('blob:')) return url;
         return `${API_BASE_URL}${url}`;
     };

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
        setUpdateError(''); // Clear previous update errors on refresh
        try {
            // Fetch based on user type
            if (user.user_type === 'client') {
                 // Clients: Fetch proposals for their projects & their projects list
                 const [proposalsRes, projectsRes] = await Promise.all([
                     axiosInstance.get('/proposals/'), // Queryset filtered by backend view based on project client
                     axiosInstance.get(`/projects/`) // Queryset filtered by backend view based on client=user
                 ]);
                setProposals(proposalsRes.data.results || proposalsRes.data);
                setProjects(projectsRes.data.results || projectsRes.data);
            } else if (user.user_type === 'freelancer') {
                // Freelancers: Fetch proposals they submitted
                const proposalsRes = await axiosInstance.get('/proposals/'); // Queryset filtered by backend view based on freelancer=user
                setProposals(proposalsRes.data.results || proposalsRes.data);
                setLoadingProjects(false); // No projects needed for freelancer main dash display
            }
        } catch (error) {
            setError("Failed to fetch dashboard data.");
            console.error("Dashboard fetch error:", error?.response?.data || error?.message || error);
        } finally {
            setLoadingProposals(false);
            setLoadingProjects(false); // Ensure this is always set
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [user, axiosInstance]); // Refetch if user changes


    const handleUpdateStatus = async (id, status) => {
        setUpdateError(''); // Clear previous update error
        try {
             // Correct endpoint for the custom action
            await axiosInstance.patch(`/proposals/${id}/update-status/`, { status });
            // Refresh proposals after update
            fetchDashboardData(); // Refetch all dashboard data
        } catch (error) {
             const errorData = error.response?.data;
             // Extract detailed error message
             const errorMsg = typeof errorData === 'string' ? errorData :
                              errorData?.detail ||
                              (errorData && Object.values(errorData).flat().join(' ')) || // Flatten errors
                              'Failed to update proposal status.';
            setUpdateError(`${errorMsg}`); // Set specific error message
            console.error('Failed to update proposal status:', errorMsg, error.response?.data || error.message);
            // Optionally: alert(`Failed to update status: ${errorMsg}`);
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
                const errorMsg = error.response?.data?.detail || 'Failed to delete proposal.';
                console.error('Failed to delete proposal:', errorMsg, error.response?.data || error.message);
                alert(`Failed to delete proposal: ${errorMsg}`);
            }
        }
    };

     const handleCloseEditModal = () => {
         setShowEditProposalModal(false);
         setProposalToEdit(null);
         fetchDashboardData(); // Refresh data when modal closes, in case changes were made
     };

    // --- Project Delete Handler (for Client) ---
     const handleDeleteProject = async (id) => {
        if (window.confirm('Are you sure you want to delete this project? This will also delete associated proposals and reviews.')) {
            try {
                await axiosInstance.delete(`/projects/${id}/`);
                alert('Project deleted successfully.');
                fetchDashboardData(); // Refresh project list
            } catch (error) {
                 const errorMsg = error.response?.data?.detail || 'Failed to delete project.';
                 console.error('Failed to delete project:', errorMsg, error.response?.data || error.message);
                alert(`Failed to delete project: ${errorMsg}`);
            }
        }
    };

    if (!user) {
        // Handle case where user data is not yet available (e.g., during initial load/redirect)
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }


    const renderClientDashboard = () => (
        <>
             {/* Display proposal update errors prominently */}
             {updateError && <Alert variant="danger" onClose={() => setUpdateError('')} dismissible>{updateError}</Alert>}

            {/* Proposals Received */}
            <Card className="mb-4 shadow-sm">
                <Card.Header as="h5">Proposals Received</Card.Header>
                {loadingProposals ? <Card.Body className="text-center"><Spinner size="sm"/></Card.Body> :
                 error && !updateError ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                 proposals.length > 0 ? (
                    <ListGroup variant="flush">
                        {proposals.map(p => (
                            <ListGroup.Item key={p.id} className="px-3 py-2">
                                <Row className="align-items-center g-2">
                                    <Col md={7}>
                                         Proposal from <strong>{p.freelancer}</strong> for <Link to={`/project/${p.project}`} title={p.project_title}>"{p.project_title.length > 30 ? p.project_title.substring(0, 30)+'...' : p.project_title}"</Link>
                                         <br/><small className="text-muted">Rate: ₹{p.proposed_rate}</small>
                                         {/* Rating UI */}
                                         <div className="mt-2">
                                             <Form.Label className="me-2 mb-0">Rating:</Form.Label>
                                             <Form.Select
                                                 size="sm"
                                                 style={{ width: '120px', display: 'inline-block' }}
                                                 value={p.rating || ''}
                                                 onChange={async (e) => {
                                                     const newRating = e.target.value ? parseInt(e.target.value) : null;
                                                     try {
                                                         await axiosInstance.patch(`/proposals/${p.id}/rate/`, { rating: newRating });
                                                         fetchDashboardData();
                                                         alert('Rating updated!');
                                                     } catch (err) {
                                                         alert('Failed to update rating.');
                                                     }
                                                 }}
                                                 disabled={user.username !== p.project_client}
                                             >
                                                 <option value="">Not rated</option>
                                                 {[1,2,3,4,5].map(val => (
                                                     <option key={val} value={val}>{val} Star{val > 1 ? 's' : ''}</option>
                                                 ))}
                                             </Form.Select>
                                         </div>
                                    </Col>
                                     <Col md={2} className="text-md-center">
                                          <Badge bg={p.status === 'pending' ? 'warning' : (p.status === 'accepted' ? 'success' : 'danger')}>{p.status}</Badge>
                                    </Col>
                                    <Col md={3} className="text-md-end">
                                         {p.status === 'pending' && (
                                            <div className="d-flex justify-content-end justify-content-md-end gap-1">
                                                <Button variant="success" size="sm" onClick={() => handleUpdateStatus(p.id, 'accepted')} title="Accept Proposal">
                                                    <Check size={16} /> <span className="d-none d-lg-inline">Accept</span>
                                                </Button>
                                                <Button variant="danger" size="sm" onClick={() => handleUpdateStatus(p.id, 'rejected')} title="Reject Proposal">
                                                    <X size={16} /> <span className="d-none d-lg-inline">Reject</span>
                                                </Button>
                                            </div>
                                         )}
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted mb-0">No proposals received yet.</p></Card.Body>
                }
            </Card>

            {/* My Projects */}
            <Card className="shadow-sm">
                 <Card.Header as="h5">My Posted Projects</Card.Header>
                 {loadingProjects ? <Card.Body className="text-center"><Spinner size="sm"/></Card.Body> :
                  error ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                  projects.length > 0 ? (
                     <ListGroup variant="flush">
                        {projects.map(proj => (
                            <ListGroup.Item key={proj.id} className="px-3 py-2">
                                <Row className="align-items-center g-2">
                                     <Col md={7}>
                                        <Link to={`/project/${proj.id}`}>{proj.title}</Link> <Badge bg={proj.status === 'active' ? 'success' : (proj.status === 'in_progress' ? 'warning' : proj.status === 'completed' ? 'primary' : 'secondary')} className="ms-2">{proj.status.replace('_', ' ')}</Badge>
                                    </Col>
                                     <Col md={5} className="text-md-end">
                                        <div className="d-flex justify-content-end justify-content-md-end gap-1">
                                            <Button variant="outline-secondary" size="sm" as={Link} to={`/project/${proj.id}/edit`} title="Edit Project">
                                                 <Edit size={16} /> <span className="d-none d-lg-inline">Edit</span>
                                            </Button>
                                             <Button variant="outline-danger" size="sm" onClick={() => handleDeleteProject(proj.id)} title="Delete Project">
                                                 <Trash2 size={16} /> <span className="d-none d-lg-inline">Delete</span>
                                            </Button>
                                        </div>
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted mb-0">You haven't posted any projects yet. <Link to="/project/new">Post one now!</Link></p></Card.Body>
                }
            </Card>
        </>
    );

    const renderFreelancerDashboard = () => {
        const getStatusBadge = (status) => {
            switch (status) {
                case 'accepted': return <Badge bg="success">Accepted</Badge>;
                case 'rejected': return <Badge bg="danger">Rejected</Badge>;
                default: return <Badge bg="warning" text="dark">Pending</Badge>; // Dark text for warning
            }
        };

        return (
            <Card className="shadow-sm">
                <Card.Header as="h5">My Submitted Proposals</Card.Header>
                 {loadingProposals ? <Card.Body className="text-center"><Spinner size="sm"/></Card.Body> :
                  error ? <Card.Body><Alert variant="danger">{error}</Alert></Card.Body> :
                 proposals.length > 0 ? (
                    <ListGroup variant="flush">
                        {proposals.map(p => (
                            <ListGroup.Item key={p.id} className="px-3 py-2">
                                 <Row className="align-items-center g-2">
                                    <Col md={7}>
                                        Proposal for <Link to={`/project/${p.project}`} title={p.project_title}>"{p.project_title.length > 40 ? p.project_title.substring(0, 40)+'...' : p.project_title}"</Link>
                                    </Col>
                                     <Col md={2} xs={4} className="text-md-center"> {/* Adjusted column size */}
                                         {getStatusBadge(p.status)}
                                    </Col>
                                    <Col md={3} xs={8} className="text-md-end"> {/* Adjusted column size */}
                                        {/* Allow edit/delete only if pending */}
                                        {p.status === 'pending' && (
                                            <div className="d-flex justify-content-end justify-content-md-end gap-1">
                                                <Button variant="outline-secondary" size="sm" onClick={() => handleEditProposal(p)} title="Edit Proposal">
                                                    <Edit size={16} /> <span className="d-none d-md-inline">Edit</span>
                                                </Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDeleteProposal(p.id)} title="Delete Proposal">
                                                    <Trash2 size={16} /> <span className="d-none d-md-inline">Delete</span>
                                                </Button>
                                            </div>
                                        )}
                                        {/* Optionally add 'View Contract' if accepted */}
                                        {p.status === 'accepted' && (
                                             <Button variant="outline-info" size="sm" as={Link} to="/contracts">
                                                 View Contract
                                             </Button>
                                        )}
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                 ) : <Card.Body><p className="text-muted mb-0">You have not submitted any proposals. <Link to="/projects">Find work!</Link></p></Card.Body>
                }
            </Card>
        );
    };

     const profilePicUrl = getFullImageUrl(user?.profilePicture) || `https://via.placeholder.com/50/ced4da/6c757d?text=${user?.username?.charAt(0).toUpperCase() || '?'}`;


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
                             <ListGroup.Item action as={Link} to="/saved-projects"><Bookmark size={16} className="me-2"/> Saved Projects</ListGroup.Item>
                             <ListGroup.Item action as={Link} to="/activities"><Activity size={16} className="me-2"/> Activity Feed</ListGroup.Item>
                             <ListGroup.Item action as={Link} to="/wallet"><WalletIcon size={16} className="me-2"/> Wallet</ListGroup.Item>
                             {user.user_type === 'client' && <ListGroup.Item action as={Link} to="/analytics"><BarChart3 size={16} className="me-2"/> Analytics</ListGroup.Item>}
                             {user.user_type === 'freelancer' && <ListGroup.Item action as={Link} to="/invoices"><FileText size={16} className="me-2"/> Invoices</ListGroup.Item>}
                             {/* Add more links as needed */}
                        </ListGroup>
                    </Card>
                </Col>

                {/* Main Content Area */}
                <Col md={9}>
                    {/* Welcome Card */}
                    <Card className="shadow-sm mb-4">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-3">
                                 <Image src={profilePicUrl} roundedCircle style={{ width: '50px', height: '50px', marginRight: '15px', objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                <div>
                                     <Card.Title className="fs-4 mb-0">Welcome back, {user.username}!</Card.Title>
                                     <Card.Text className="text-muted mb-0">Role: <Badge bg="info">{user.user_type}</Badge></Card.Text>
                                     <BadgeDisplay />
                                </div>
                            </div>
                            {/* Actions */}
                             {user.user_type === 'client' && <Button as={Link} to="/project/new" variant="primary"><PlusCircle size={16} className="me-1"/> Post New Project</Button>}
                             {user.user_type === 'freelancer' && <Button as={Link} to="/projects" variant="primary"><Search size={16} className="me-1"/> Find Work</Button>}
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
                projectId={proposalToEdit?.project} // Pass project ID for context, might not be needed if PUT/PATCH doesn't require it
                existingProposal={proposalToEdit}
                onProposalUpdate={fetchDashboardData} // Pass callback to refresh data
            />
        </Container>
    );
};

// --- CORRECTED Messaging Page Component (Inline Implementation) ---
const MessagingPage = () => {
    const { user, axiosInstance } = useAuth();
    // State: conversations stores messages grouped by partner username
    const [conversations, setConversations] = useState({}); // { partnerUsername: [message1, message2], ... }
    const [activeConversationUser, setActiveConversationUser] = useState(null); // Username of the active chat partner
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true); // Initial load state
    const [isSending, setIsSending] = useState(false); // Sending message state
    const [fetchError, setFetchError] = useState(''); // Error during fetching
    const [sendError, setSendError] = useState(''); // Error during sending
    const [newChatUser, setNewChatUser] = useState(''); // For starting new chat
    const [newChatError, setNewChatError] = useState(''); // Error for new chat input

    const messagesEndRef = useRef(null); // Ref to scroll to the bottom of messages
    const pollingIntervalRef = useRef(null); // Ref for the polling interval

    // --- Utility: Scroll to bottom ---
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50); // Small delay allows DOM to update
    }, []);

    // --- Fetch ALL relevant messages and group them ---
    const fetchAndGroupMessages = useCallback(async (isInitialLoad = false) => {
        if (!user?.username) return; // Need user context

        if (isInitialLoad) {
            setLoading(true);
            setFetchError('');
        }
        // Don't set loading or clear error for background polls

        try {
            // Fetch all messages involving the current user
            const response = await axiosInstance.get('/messages/'); // Use the correct endpoint
            const fetchedMessages = response.data.results || response.data || [];

            // Group messages by conversation partner
            const groupedConversations = fetchedMessages.reduce((acc, msg) => {
                const senderUsername = msg.sender;
                const receiverUsername = msg.receiver;

                // Ensure message has valid sender/receiver and user context exists
                if (!senderUsername || !receiverUsername || !user?.username) {
                    console.warn("Skipping message due to missing sender/receiver/user:", msg);
                    return acc;
                }

                const partnerUsername = senderUsername === user.username ? receiverUsername : senderUsername;

                if (!acc[partnerUsername]) {
                    acc[partnerUsername] = [];
                }

                // Add message only if it's not already present (handles polling overlap)
                if (!acc[partnerUsername].some(existing => existing.id === msg.id)) {
                    acc[partnerUsername].push(msg);
                    // Sort messages within the conversation by timestamp
                    acc[partnerUsername].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                }

                return acc;
            }, {}); // Start with empty object

            // Update the conversations state
            setConversations(groupedConversations);

            // Auto-select the most recent conversation partner on initial load if none selected
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
            if (isInitialLoad) {
                setFetchError('Failed to fetch messages. Please try again later.');
            }
            console.error("Fetch messages error:", err.response?.data || err.message || err);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    }, [user, axiosInstance, activeConversationUser]); 

    useEffect(() => {
        fetchAndGroupMessages(true); 
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(() => {
            fetchAndGroupMessages(false); 
        }, 8000); 

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [fetchAndGroupMessages]); 

  
    useEffect(() => {
        if (activeConversationUser) { 
            scrollToBottom();
        }
    }, [activeConversationUser, conversations, scrollToBottom]); 

    const handleSelectConversation = (username) => {
        setActiveConversationUser(username);
        setSendError('');
        setNewChatError('');
        setNewMessage(''); 
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !activeConversationUser) return;

        setIsSending(true);
        setSendError('');

        try {
            const response = await axiosInstance.post('/messages/', {
                receiver_username: activeConversationUser, 
                content: newMessage.trim(),
            });
            const sentMessage = response.data;
            setConversations(prev => {
                const updatedConversations = { ...prev };
                const partner = activeConversationUser; 

                if (!updatedConversations[partner]) {
                    updatedConversations[partner] = [];
                }

                if (!updatedConversations[partner].some(msg => msg.id === sentMessage.id)) {
                    updatedConversations[partner] = [...updatedConversations[partner], sentMessage];
                     updatedConversations[partner].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                }

                return updatedConversations;
            });

            setNewMessage(''); 
            scrollToBottom(); 

        } catch (err) {
            const errorData = err.response?.data;
            let detailedError = "Failed to send message.";
            if (errorData) {
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

    const handleStartNewChat = () => {
         setNewChatError('');
         const targetUser = newChatUser.trim();
         if (!targetUser) {
             setNewChatError('Please enter a username.');
             return;
         }
         if (targetUser === user.username) {
             setNewChatError('You cannot chat with yourself.');
             return;
         }

         if (!conversations[targetUser]) {
              setConversations(prev => ({ ...prev, [targetUser]: [] })); 
         }
         setActiveConversationUser(targetUser);
         setNewChatUser('');
     };

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" role="status"><span className="visually-hidden">Loading messages...</span></Spinner></Container>;
    }
    const conversationPartners = Object.entries(conversations)
        .sort(([, msgsA], [, msgsB]) => {
            const lastMsgTimeA = msgsA.length ? new Date(msgsA[msgsA.length - 1].timestamp).getTime() : 0;
            const lastMsgTimeB = msgsB.length ? new Date(msgsB[msgsB.length - 1].timestamp).getTime() : 0;
            return lastMsgTimeB - lastMsgTimeA; 
        })
        .map(([username]) => username);
    const activeMessages = activeConversationUser ? conversations[activeConversationUser] || [] : [];


    return (
        <Container fluid className="py-3 vh-100 d-flex flex-column">
            <h1 className="mb-3 h4"><MessageSquare size={20} className="me-2"/>Messages</h1>

            {fetchError && !loading && <Alert variant="warning" className="mb-2">{fetchError}</Alert>}

            <Row className="flex-grow-1" style={{ minHeight: 0 }}>

                <Col md={4} lg={3} className="d-flex flex-column mb-3 mb-md-0 h-100">
                    <Card className="flex-grow-1 d-flex flex-column shadow-sm">
                        <Card.Header className="fw-bold">Conversations</Card.Header>
                       
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
                       
                        <ListGroup variant="flush" className="flex-grow-1" style={{ overflowY: 'auto' }}>
                            {conversationPartners.length > 0 ? (
                                conversationPartners.map(partner => (
                                    <ListGroup.Item
                                        key={partner}
                                        action
                                        active={partner === activeConversationUser}
                                        onClick={() => handleSelectConversation(partner)}
                                        className="d-flex justify-content-between align-items-center text-break" // Allow long usernames to wrap
                                    >
                                         <span>{partner}</span>
                                        {conversations[partner]?.length > 0 &&
                                            <small className="text-muted ms-2 text-nowrap">
                                                {new Date(conversations[partner][conversations[partner].length - 1].timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </small>
                                        }
                                    </ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item className="text-muted text-center">No active conversations.</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card>
                </Col>

                <Col md={8} lg={9} className="d-flex flex-column h-100">
                    <Card className="flex-grow-1 d-flex flex-column shadow-sm">
                        <Card.Header>
                            {activeConversationUser ? (
                                <>Chat with <strong>{activeConversationUser}</strong></>
                            ) : (
                                'Select or start a conversation'
                            )}
                        </Card.Header>
                        <Card.Body className="d-flex flex-column" style={{ overflowY: 'auto', flexGrow: 1 }}>
                            {!activeConversationUser ? (
                                <p className="text-muted text-center m-auto">Select a conversation from the list or start a new one.</p>
                            ) : activeMessages.length === 0 ? (
                                <p className="text-muted text-center m-auto">No messages yet. Send the first one!</p>
                            ) : (
                                <>
                                    {activeMessages.map((message, index) => (
                                        <div
                                            key={message.id || `msg-${index}`} 
                                            className={`mb-2 d-flex ${message.sender === user.username ? 'justify-content-end' : 'justify-content-start'}`}
                                        >
                                            <div
                                                className={`p-2 rounded shadow-sm ${message.sender === user.username ? 'bg-primary text-white' : 'bg-light border'}`}
                                                style={{ maxWidth: '75%', wordBreak: 'break-word' }}
                                            >
                                                 <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                                                 <small className={`d-block text-end mt-1 ${message.sender === user.username ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7em' }}>
                                                      {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                  </small>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} style={{ height: '1px' }} />
                                </>
                            )}
                        </Card.Body>

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
                                            style={{ resize: 'none', overflowY: 'auto', minHeight: '40px' }} 
                                             onKeyDown={(e) => {
                                                 if (e.key === 'Enter' && !e.shiftKey) {
                                                     e.preventDefault(); 
                                                     if (!isSending && newMessage.trim()) {
                                                         handleSendMessage();
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

// --- FEATURE 1: Saved Projects Page ---
const SavedProjectsPage = () => {
    const { user, axiosInstance } = useAuth();
    const [savedProjects, setSavedProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSavedProjects = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const response = await axiosInstance.get('/saved-projects/');
                setSavedProjects(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch saved projects.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSavedProjects();
    }, [user, axiosInstance]);

    const handleUnsave = async (projectId) => {
        try {
            const savedProject = savedProjects.find(sp => sp.project.id === projectId);
            if (savedProject) {
                await axiosInstance.delete(`/saved-projects/${savedProject.id}/`);
                setSavedProjects(prev => prev.filter(sp => sp.id !== savedProject.id));
            }
        } catch (err) {
            alert('Failed to unsave project.');
            console.error(err);
        }
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container><Alert variant="danger">{error}</Alert></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="gradient-text"><Bookmark className="me-2" />Saved Projects</h1>
            </div>
            {savedProjects.length > 0 ? (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {savedProjects.map(sp => (
                        <Col key={sp.id}>
                            <Card className="h-100 shadow-sm saved-project-card project-card">
                                <Card.Body className="d-flex flex-column">
                                    <Card.Title>
                                        <Link to={`/project/${sp.project.id}`} className="text-decoration-none stretched-link">
                                            {sp.project.title}
                                        </Link>
                                    </Card.Title>
                                    <Card.Text className="flex-grow-1">
                                        {sp.project.description.length > 100 ? sp.project.description.substring(0, 100) + '...' : sp.project.description}
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                                        <span className="fw-bold fs-5 text-success">₹{sp.project.budget}</span>
                                        <Button variant="outline-danger" size="sm" onClick={() => handleUnsave(sp.project.id)}>
                                            <BookmarkCheck size={16} className="me-1" /> Unsave
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Alert variant="info">You haven't saved any projects yet. Start browsing and save projects you're interested in!</Alert>
            )}
        </Container>
    );
};

// --- FEATURE 2: Activity Feed Page ---
const ActivityFeedPage = () => {
    const { user, axiosInstance } = useAuth();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchActivities = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const response = await axiosInstance.get('/activities/');
                setActivities(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch activities.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
        const interval = setInterval(fetchActivities, 30000); 
        return () => clearInterval(interval);
    }, [user, axiosInstance]);

    const getActivityIcon = (action) => {
        switch (action) {
            case 'project_created': return <Briefcase size={20} />;
            case 'proposal_submitted': return <FileText size={20} />;
            case 'proposal_accepted': return <Check size={20} />;
            case 'contract_created': return <Award size={20} />;
            case 'review_submitted': return <Star size={20} />;
            default: return <Activity size={20} />;
        }
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container><Alert variant="danger">{error}</Alert></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <h1 className="mb-4 gradient-text"><Activity className="me-2" />Activity Feed</h1>
            {activities.length > 0 ? (
                <div>
                    {activities.map(activity => (
                        <div key={activity.id} className="activity-item animate-slide-in">
                            <div className="d-flex align-items-start">
                                <div className="me-3 mt-1 text-primary">{getActivityIcon(activity.action)}</div>
                                <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between">
                                        <strong>{activity.user}</strong>
                                        <small className="text-muted">{new Date(activity.timestamp).toLocaleString()}</small>
                                    </div>
                                    <p className="mb-0 mt-1">{activity.description}</p>
                                    {activity.related_project && (
                                        <Link to={`/project/${typeof activity.related_project === 'object' ? activity.related_project.id : activity.related_project}`} className="text-decoration-none">
                                            View Project →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Alert variant="info">No activities to display yet.</Alert>
            )}
        </Container>
    );
};

// --- FEATURE : Analytics Dashboard Page ---
const AnalyticsPage = () => {
    const { user, axiosInstance } = useAuth();
    const [analytics, setAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const response = await axiosInstance.get('/analytics/');
                setAnalytics(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch analytics.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [user, axiosInstance]);

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container><Alert variant="danger">{error}</Alert></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <h1 className="mb-4 gradient-text"><BarChart3 className="me-2" />Project Analytics</h1>
            {analytics.length > 0 ? (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {analytics.map(anal => (
                        <Col key={anal.id}>
                            <Card className="shadow-sm">
                                <Card.Header>
                                    <Link to={`/project/${typeof anal.project === 'object' ? anal.project : anal.project}`} className="text-white text-decoration-none">
                                        Project Analytics
                                    </Link>
                                </Card.Header>
                                <Card.Body>
                                    <div className="analytics-card">
                                        <h3>{anal.total_views}</h3>
                                        <p>Total Views</p>
                                    </div>
                                    <Row className="mt-3">
                                        <Col xs={6}>
                                            <div className="text-center">
                                                <h4 className="text-primary">{anal.unique_views}</h4>
                                                <small className="text-muted">Unique Views</small>
                                            </div>
                                        </Col>
                                        <Col xs={6}>
                                            <div className="text-center">
                                                <h4 className="text-success">{anal.proposals_count}</h4>
                                                <small className="text-muted">Proposals</small>
                                            </div>
                                        </Col>
                                        <Col xs={12} className="mt-2">
                                            <div className="text-center">
                                                <h4 className="text-warning">{anal.saved_count}</h4>
                                                <small className="text-muted">Saved Count</small>
                                            </div>
                                        </Col> </Row>  </Card.Body></Card>
                        </Col> ))}
                </Row> ) : (
                <Alert variant="info">No analytics data available yet.</Alert>
            )}
        </Container>
    );};

// --- Feature : Advanced Filters Component (used in ProjectListPage) ---
const AdvancedFilters = ({ onFilterChange, availableSkills }) => {
    const defaultFilters = {
        minBudget: '',
        maxBudget: '',
        status: 'active',
        sortBy: 'created_at'
    };

    // 2. The component now manages its own state
    const [filters, setFilters] = useState(defaultFilters);
    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilterChange(newFilters); 
    };

    const handleClear = () => {
        setFilters(defaultFilters);    
        onFilterChange(defaultFilters); 
    };

    return (
        <Card className="filter-panel animate-slide-in">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <span>
                    <Filter className="me-2" /> Advanced Filters
                </span>
                <Button variant="outline-danger" size="sm" onClick={handleClear}>
                    Clear Filters
                </Button>
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Min Budget (₹)</Form.Label>
                            <Form.Control type="number" value={filters.minBudget} onChange={e => handleFilterChange('minBudget', e.target.value)} placeholder="0" />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Max Budget (₹)</Form.Label>
                            <Form.Control type="number" value={filters.maxBudget} onChange={e => handleFilterChange('maxBudget', e.target.value)} placeholder="100000" />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Status</Form.Label>
                            <Form.Select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
                                <option value="active">Active</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Sort By</Form.Label>
                            <Form.Select value={filters.sortBy} onChange={e => handleFilterChange('sortBy', e.target.value)}>
                                <option value="created_at">Newest</option>
                                <option value="-budget">Budget: High to Low</option>
                                <option value="budget">Budget: Low to High</option>
                                <option value="-view_count">Most Viewed</option>
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

// --- Feature:Badge Display Component ---
export const BadgeDisplay = ({ userId }) => {
    const { axiosInstance } = useAuth();
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(false);

    const getBadgeIcon = (badgeType) => {
        switch (badgeType) {
            case 'verified': return <Shield size={16} />;
            case 'top_freelancer': case 'top_client': return <Trophy size={16} />;
            case 'excellent_review': return <Star size={16} />;
            default: return <Award size={16} />;
        }
    };

    useEffect(() => {
        const fetchBadges = async () => {
            setLoading(true);
            try {
                const url = userId ? `/badges/?user_id=${userId}` : '/badges/';
                const response = await axiosInstance.get(url);
                setBadges(response.data.results || response.data);
            } catch (err) {
                console.error('Failed to fetch badges:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchBadges();
    }, [userId, axiosInstance]);

    if (loading) return <Spinner size="sm" />;
    if (badges.length === 0) return null;

    return (
        <div className="badge-container">
            {badges.map(badge => (
                <span key={badge.id} className="user-badge" title={badge.description || badge.badge_type}>
                    {getBadgeIcon(badge.badge_type)}
                    {badge.get_badge_type_display || badge.badge_type.replace(/_/g, ' ')}
                </span>
            ))}
        </div>
    );
};

// --- Main App Component ---
function App() {
    return (
        <AuthProvider>
            <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
                <AppNavbar />
                <main className="flex-grow-1"> 
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/review/:projectId" element={<ReviewPage />} />
                        <Route path="/project/:id" element={<ProjectDetailPage />} />
                        <Route path="/projects" element={<ProjectListPage />} />
                        <Route path="/contracts" element={<ContractsPage />} />
                        <Route path="/messages" element={<MessagingPage />} />
                        <Route path="/project/new" element={<ProjectCreatePage />} />
                        <Route path="/project/:id/edit" element={<ProjectEditPage />} />
                        <Route path="/saved-projects" element={<SavedProjectsPage />} />
                        <Route path="/activities" element={<ActivityFeedPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/wallet" element={<WalletPage />} />
                        <Route path="/project/:id/milestones" element={<MilestonesPage />} />
                        <Route path="/invoices" element={<InvoicesPage />} />
                        <Route path="*" element={
                            <Container className="py-5 text-center">
                                <h2>404 Not Found</h2>
                                <p>The page you requested does not exist.</p>
                                <Link to="/">Go Home</Link>
                            </Container>
                        } />
                    </Routes>
                </main>
                <footer className="bg-light text-center text-muted py-3 mt-auto border-top">
                    <Container>
                        &copy; {new Date().getFullYear()} TalentLink. All rights reserved.
                    </Container>
                </footer>
            </div>
        </AuthProvider>
    );
}
export default App;