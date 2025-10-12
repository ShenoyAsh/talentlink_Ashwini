import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Import React Bootstrap components
import { Navbar, Nav, Container, Button, Form, Card, Row, Col, Alert } from 'react-bootstrap';
import { Briefcase, LogOut } from 'lucide-react';


const API_URL = 'http://127.0.0.1:8000/api';

// --- Authentication Context ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [tokens, setTokens] = useState(() => localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null);
    const navigate = useNavigate();

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/token/`, { username, password });
            setTokens(response.data);
            const userResponse = await axios.get(`${API_URL}/profiles/`, {
                headers: { Authorization: `Bearer ${response.data.access}` }
            });

            if (userResponse.data.length > 0) {
              const profile = userResponse.data[0];
              const userDetails = { username: profile.user, user_type: profile.user_type || 'freelancer' };
              setUser(userDetails);
              localStorage.setItem('authTokens', JSON.stringify(response.data));
              localStorage.setItem('user', JSON.stringify(userDetails));
            }
            navigate('/dashboard');
        } catch (error) {
            console.error("Login failed:", error);
            alert("Login failed. Please check your credentials.");
        }
    };

    const register = async (userData) => {
        try {
            await axios.post(`${API_URL}/register/`, userData);
            navigate('/login');
            alert("Registration successful! Please log in.");
        } catch (error) {
            console.error("Registration failed:", error.response ? error.response.data : error.message);
            const errorMsg = error.response ? JSON.stringify(error.response.data) : "An unknown error occurred.";
            alert(`Registration failed: ${errorMsg}`);
        }
    };

    const logout = () => {
        setUser(null);
        setTokens(null);
        localStorage.removeItem('authTokens');
        localStorage.removeItem('user');
        navigate('/login');
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, tokens, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- Main Layout Components ---
const AppNavbar = () => {
    const { user, logout } = useAuth();
    return (
        <Navbar bg="light" expand="lg" className="shadow-sm">
            <Container>
                <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center">
                    <Briefcase className="me-2 text-primary" />
                    TalentLink
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/projects">Find Work</Nav.Link>
                        <Nav.Link as={Link} to="/clients">Find Talent</Nav.Link>
                    </Nav>
                    <Nav>
                        {user ? (
                            <>
                                <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                                <Navbar.Text className="me-3">Hi, {user.username}</Navbar.Text>
                                <Button variant="outline-secondary" size="sm" onClick={logout}>
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

const AppFooter = () => (
    <footer className="bg-light mt-auto py-3">
        <Container className="text-center text-muted">
            &copy; 2025 TalentLink. All rights reserved.
        </Container>
    </footer>
);

// --- Page Components ---
const HomePage = () => (
    <div className="bg-light py-5 flex-grow-1">
        <Container className="text-center py-5">
            <h1 className="display-4 fw-bold mb-3">Find the Best Freelance Talent</h1>
            <p className="lead text-muted mb-4">Connect with skilled professionals, manage projects seamlessly, and grow your business.</p>
            <div>
                <Button as={Link} to="/register" variant="primary" size="lg" className="me-2">Get Started</Button>
                <Button as={Link} to="/projects" variant="secondary" size="lg">Browse Projects</Button>
            </div>
        </Container>
    </div>
);

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();

    const handleSubmit = (e) => {
        e.preventDefault();
        login(username, password);
    };

    return (
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
            <Card style={{ width: '24rem' }} className="p-3 shadow">
                <Card.Body>
                    <h2 className="text-center mb-4">Sign In</h2>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3" controlId="formBasicUsername">
                            <Form.Label>Username</Form.Label>
                            <Form.Control type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100">
                            Sign In
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

const RegisterPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('freelancer');
    const { register } = useAuth();

    const handleSubmit = (e) => {
        e.preventDefault();
        register({ username, email, password, user_type: userType });
    };

    return (
        <Container className="d-flex align-items-center justify-content-center py-5">
             <Card style={{ width: '24rem' }} className="p-3 shadow">
                <Card.Body>
                    <h2 className="text-center mb-4">Create an Account</h2>
                    <Form onSubmit={handleSubmit}>
                         <Form.Group className="mb-3">
                            <Form.Label>Username</Form.Label>
                            <Form.Control type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                        </Form.Group>
                         <Form.Group className="mb-3">
                            <Form.Label>Email address</Form.Label>
                            <Form.Control type="email" placeholder="Enter email" value={email} onChange={e => setEmail(e.target.value)} required />
                        </Form.Group>
                         <Form.Group className="mb-3">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                             <Form.Label>I am a:</Form.Label>
                             <div>
                                <Form.Check inline label="Freelancer" name="userType" type="radio" value="freelancer" checked={userType === 'freelancer'} onChange={e => setUserType(e.target.value)} id="freelancer-radio" />
                                <Form.Check inline label="Client" name="userType" type="radio" value="client" checked={userType === 'client'} onChange={e => setUserType(e.target.value)} id="client-radio" />
                             </div>
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100">
                            Sign Up
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

const ProjectListPage = () => {
    const [projects, setProjects] = useState([]);
    const { tokens } = useAuth();
    
    useEffect(() => {
        const fetchProjects = async () => {
            if (!tokens) return;
            try {
                const response = await axios.get(`${API_URL}/projects/`, {
                    headers: { Authorization: `Bearer ${tokens.access}` }
                });
                setProjects(response.data);
            } catch (error) {
                console.error("Failed to fetch projects:", error);
            }
        };
        fetchProjects();
    }, [tokens]);

    return (
        <Container className="py-5">
            <h1 className="mb-4">Open Projects</h1>
            {projects.length > 0 ? projects.map(project => (
                <Card key={project.id} className="mb-3">
                    <Card.Body>
                        <Card.Title>{project.title}</Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">Posted by: {project.client}</Card.Subtitle>
                        <Card.Text>{project.description.substring(0, 200)}...</Card.Text>
                        <Card.Text className="fw-bold fs-5">${project.budget}</Card.Text>
                        <Button variant="primary">View Project</Button>
                    </Card.Body>
                </Card>
            )) : <Alert variant="info">No open projects found.</Alert>}
        </Container>
    );
}

const DashboardPage = () => {
    const { user } = useAuth();
    if (!user) return <p>Loading...</p>;

    return (
        <Container className="py-5">
            <h1 className="mb-4">Dashboard</h1>
            <Card>
                <Card.Body>
                    <Card.Title className="fs-2">Welcome back, {user.username}!</Card.Title>
                    <Card.Text>
                        Your user type is: <span className="fw-bold text-primary text-capitalize">{user.user_type}</span>
                    </Card.Text>
                </Card.Body>
            </Card>
        </Container>
    );
}


// --- Main App Component ---
function App() {
    return (
        <AuthProvider>
            <div className="d-flex flex-column bg-light" style={{ minHeight: "100vh" }}>
                <AppNavbar />
                <main className="flex-grow-1">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/projects" element={<ProjectListPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                    </Routes>
                </main>
                <AppFooter />
            </div>
        </AuthProvider>
    );
}

export default App;

