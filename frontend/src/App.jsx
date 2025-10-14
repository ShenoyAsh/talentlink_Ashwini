import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';


import { Navbar, Nav, Container, Button, Form, Card, Row, Col, Alert, Spinner, Badge, ListGroup, Modal, InputGroup } from 'react-bootstrap';
import { Briefcase, LogOut, User, DollarSign, Clock, PlusCircle, Search, Check, X } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000/api';

// --- Axios Interceptor for Auth ---
const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 5000,
});

// --- Authentication Context ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);
    const [tokens, setTokens] = useState(() => localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const interceptor = axiosInstance.interceptors.request.use(config => {
            const currentTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
            if (currentTokens?.access) {
                config.headers.Authorization = `Bearer ${currentTokens.access}`;
            }
            return config;
        });
        return () => axiosInstance.interceptors.request.eject(interceptor);
    }, []);

    const login = async (username, password) => {
        setLoading(true);
        try {
            const tokenResponse = await axios.post(`${API_URL}/token/`, { username, password });
            setTokens(tokenResponse.data);
            localStorage.setItem('authTokens', JSON.stringify(tokenResponse.data));
            axiosInstance.defaults.headers['Authorization'] = `Bearer ${tokenResponse.data.access}`;

            const profileResponse = await axiosInstance.get('/profiles/');
            if (profileResponse.data.length > 0) {
                const profile = profileResponse.data[0];
                const userDetails = { username: profile.user, user_type: profile.user_type, profileId: profile.id };
                setUser(userDetails);
                localStorage.setItem('user', JSON.stringify(userDetails));
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("Login failed:", error);
            alert("Login failed.");
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setTokens(null);
        localStorage.clear();
        delete axiosInstance.defaults.headers['Authorization'];
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, axiosInstance }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- Main Layout ---
const AppNavbar = () => {
    const { user, logout } = useAuth();
    return (
        <Navbar bg="white" expand="lg" className="shadow-sm sticky-top">
            <Container>
                <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center">
                    <Briefcase className="me-2 text-primary" />
                    TalentLink
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/projects">Find Work</Nav.Link>
                        {user?.user_type === 'client' && <Nav.Link as={Link} to="/project/new">Post a Project</Nav.Link>}
                    </Nav>
                    <Nav>
                        {user ? (
                            <>
                                <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                                <Button variant="outline-danger" size="sm" onClick={logout}>
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
const HomePage = () => {
    return (
    <>
        <div className="bg-primary text-white text-center py-5">
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
            <h2 className="text-center mb-4">Recent Projects</h2>
            <Row>
                <Col md={4} className="mb-3"><Card className="h-100"><Card.Body><Card.Title>E-commerce Website Development</Card.Title><Card.Text>Looking for a React developer to build a modern online store.</Card.Text><Badge bg="secondary" className="me-1">React</Badge><Badge bg="secondary">Django</Badge></Card.Body><Card.Footer className="fw-bold">₹2500</Card.Footer></Card></Col>
                <Col md={4} className="mb-3"><Card className="h-100"><Card.Body><Card.Title>Mobile App UI/UX Design</Card.Title><Card.Text>Need a creative designer for a new fitness application.</Card.Text><Badge bg="secondary" className="me-1">Figma</Badge><Badge bg="secondary">UI/UX</Badge></Card.Body><Card.Footer className="fw-bold">₹1500</Card.Footer></Card></Col>
                <Col md={4} className="mb-3"><Card className="h-100"><Card.Body><Card.Title>Content Writer for Tech Blog</Card.Title><Card.Text>Seeking a writer for long-form articles about AI and machine learning.</Card.Text><Badge bg="secondary">Content Writing</Badge></Card.Body><Card.Footer className="fw-bold">₹500 / hour</Card.Footer></Card></Col>
            </Row>
        </Container>
    </>
    )
};

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading } = useAuth();
    const handleSubmit = (e) => { e.preventDefault(); login(username, password); };
    return (
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
            <Card style={{ width: '24rem' }} className="p-3 shadow-lg border-0">
                <Card.Body>
                    <h2 className="text-center mb-4">Sign In</h2>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Username</Form.Label><Form.Control type="text" value={username} onChange={e => setUsername(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Password</Form.Label><Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required /></Form.Group>
                        <Button variant="primary" type="submit" className="w-100" disabled={loading}>{loading ? <Spinner as="span" animation="border" size="sm" /> : 'Sign In'}</Button>
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
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/register/`, { username, email, password, user_type: userType });
            alert("Registration successful! Please log in.");
            navigate('/login');
        } catch (error) { alert(`Registration failed: ${error.response?.data ? JSON.stringify(error.response.data) : "An error occurred."}`); }
    };
    return (
        <Container className="d-flex align-items-center justify-content-center py-5">
            <Card style={{ width: '24rem' }} className="p-3 shadow-lg border-0">
                <Card.Body>
                    <h2 className="text-center mb-4">Create an Account</h2>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Username</Form.Label><Form.Control type="text" value={username} onChange={e => setUsername(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Password</Form.Label><Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>I am a:</Form.Label><div><Form.Check inline label="Freelancer" name="userType" type="radio" value="freelancer" checked={userType === 'freelancer'} onChange={e => setUserType(e.target.value)} /><Form.Check inline label="Client" name="userType" type="radio" value="client" checked={userType === 'client'} onChange={e => setUserType(e.target.value)} /></div></Form.Group>
                        <Button variant="primary" type="submit" className="w-100">Sign Up</Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

// --- NEW --- Proposal Submission Modal
const SubmitProposalModal = ({ show, handleClose, projectId }) => {
    const [coverLetter, setCoverLetter] = useState('');
    const [proposedRate, setProposedRate] = useState('');
    const [timeAvailable, setTimeAvailable] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const { axiosInstance } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async () => {
        if (!coverLetter || !proposedRate) {
            alert('Please fill out all fields.');
            return;
        }
        try {
            await axiosInstance.post('/proposals/', {
                project: projectId,
                cover_letter: coverLetter,
                proposed_rate: proposedRate,
                time_available: timeAvailable,
                additional_info: additionalInfo,
            });
            alert('Proposal submitted successfully!');
            handleClose();
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to submit proposal', error);
            alert('Failed to submit proposal.');
        }
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton><Modal.Title>Submit a Proposal</Modal.Title></Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Cover Letter</Form.Label>
                        <Form.Control as="textarea" rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Your Proposed Rate (₹)</Form.Label>
                        <Form.Control type="number" value={proposedRate} onChange={e => setProposedRate(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Time Available</Form.Label>
                        <Form.Control type="text" value={timeAvailable} onChange={e => setTimeAvailable(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Additional Information</Form.Label>
                        <Form.Control as="textarea" rows={3} value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSubmit}>Submit</Button>
            </Modal.Footer>
        </Modal>
    );
};


const ProjectListPage = () => { /* Updated with Search */
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { axiosInstance } = useAuth();

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            try {
                // Pass search term as a query parameter
                const response = await axiosInstance.get(`/projects/?search=${searchTerm}`);
                setProjects(response.data.results || response.data); // Handle paginated or non-paginated response
            } catch (error) {
                console.error("Failed to fetch projects:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search to avoid too many API calls
        const timer = setTimeout(() => {
            fetchProjects();
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timer);

    }, [searchTerm]);

    return (
        <Container className="py-5">
            <h1 className="mb-4">Open Projects</h1>
            <InputGroup className="mb-4">
                <Form.Control
                    placeholder="Search by title or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary"><Search size={20} /></Button>
            </InputGroup>

            {loading ? <div className="text-center"><Spinner animation="border" /></div> :
             projects.length > 0 ? projects.map(project => (
                <Card key={project.id} className="mb-3 shadow-sm project-card">
                    <Card.Body>
                        <Card.Title as={Link} to={`/project/${project.id}`} className="text-decoration-none">{project.title}</Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">Posted by: {project.client}</Card.Subtitle>
                        <Card.Text>{project.description.substring(0, 150)}...</Card.Text>
                        <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold fs-5">₹{project.budget}</span>
                            <Button as={Link} to={`/project/${project.id}`} variant="outline-primary" size="sm">View Details</Button>
                        </div>
                    </Card.Body>
                </Card>
            )) : <Alert variant="info">No projects found matching your search.</Alert>}
        </Container>
    );
}

const ProjectDetailPage = () => { /* Updated with Proposal Modal */
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user, axiosInstance } = useAuth();
    const [showProposalModal, setShowProposalModal] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await axiosInstance.get(`/projects/${id}/`);
                setProject(response.data);
            } catch (error) { console.error("Failed to fetch project details", error); }
            finally { setLoading(false); }
        };
        fetchProject();
    }, [id]);

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (!project) return <Container><Alert variant="danger">Project not found.</Alert></Container>;

    return (
        <>
            <Container className="py-5">
                <Row>
                    <Col md={8}>
                        <Card className="shadow-sm"><Card.Body>
                            <Card.Title className="display-6">{project.title}</Card.Title>
                            <Card.Subtitle className="mb-3 text-muted">Posted by {project.client}</Card.Subtitle>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>
                        </Card.Body></Card>
                    </Col>
                    <Col md={4}>
                        <Card><ListGroup variant="flush">
                            <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                <DollarSign size={20} className="me-2 text-success"/> <strong>Budget</strong>
                                <span className="text-success fw-bold">₹{project.budget}</span>
                            </ListGroup.Item>
                             <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                <Clock size={20} className="me-2 text-info"/> <strong>Duration</strong>
                                <span>{project.duration || 'N/A'} days</span>
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Skills Required:</strong>
                                <div>
                                    {project.skills_required.map(skill => (
                                        <Badge key={skill.id} bg="secondary" className="me-2 mb-2">{skill.name}</Badge>
                                    ))}
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Time Slot:</strong>
                                <p>{project.time_slot || 'N/A'}</p>
                            </ListGroup.Item>
                        </ListGroup>
                        {user?.user_type === 'freelancer' && (
                            <Card.Body>
                                 <Button variant="primary" className="w-100" onClick={() => setShowProposalModal(true)}>Submit a Proposal</Button>
                            </Card.Body>
                        )}
                        </Card>
                    </Col>
                </Row>
            </Container>
            <SubmitProposalModal show={showProposalModal} handleClose={() => setShowProposalModal(false)} projectId={id} />
        </>
    );
};

const ProjectCreatePage = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [duration, setDuration] = useState('');
    const [skills, setSkills] = useState([]);
    const [availableSkills, setAvailableSkills] = useState([]);
    const [timeSlot, setTimeSlot] = useState('');
    const { axiosInstance } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const response = await axiosInstance.get('/skills/');
                setAvailableSkills(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch skills:', error);
            }
        };
        fetchSkills();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post('/projects/', {
                title,
                description,
                budget,
                duration,
                skill_ids: skills,
                time_slot: timeSlot,
            });
            alert('Project created successfully!');
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to create project:', error);
            alert('Failed to create project.');
        }
    };
    
    const handleSkillChange = (e) => {
        const selectedSkills = Array.from(e.target.selectedOptions, option => option.value);
        setSkills(selectedSkills);
    }

    return (
        <Container className="py-5">
            <h1>Create a New Project</h1>
            <Card className="p-4 shadow-sm">
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3"><Form.Label>Project Title</Form.Label><Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required /></Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} required /></Form.Group>
                    <Row>
                        <Col><Form.Group className="mb-3"><Form.Label>Budget (₹)</Form.Label><Form.Control type="number" value={budget} onChange={e => setBudget(e.target.value)} required /></Form.Group></Col>
                        <Col><Form.Group className="mb-3"><Form.Label>Duration (days)</Form.Label><Form.Control type="number" value={duration} onChange={e => setDuration(e.target.value)} /></Form.Group></Col>
                    </Row>
                    <Form.Group className="mb-3">
                        <Form.Label>Skills Required</Form.Label>
                        <Form.Control as="select" multiple value={skills} onChange={handleSkillChange}>
                            {availableSkills.map(skill => (
                                <option key={skill.id} value={skill.id}>{skill.name}</option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Time Slot</Form.Label>
                        <Form.Control type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} />
                    </Form.Group>
                    <Button type="submit" variant="primary">Post Project</Button>
                </Form>
            </Card>
        </Container>
    );
};


const DashboardPage = () => { 
    const { user, axiosInstance } = useAuth();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProposals = async () => {
        try {
            const response = await axiosInstance.get('/proposals/');
            setProposals(response.data.results || response.data);
        } catch (error) { console.error("Failed to fetch proposals", error); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (!user) return;
        fetchProposals();
    }, [user]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await axiosInstance.patch(`/proposals/${id}/update_status/`, { status });
            fetchProposals(); // Refresh proposals after update
        } catch (error) {
            console.error('Failed to update proposal status:', error);
            alert('Failed to update status.');
        }
    };

    if (!user) return <Spinner />;

    const renderClientDashboard = () => (
        <Card>
            <Card.Header as="h5">Proposals Received</Card.Header>
            <ListGroup variant="flush">
                {loading ? <ListGroup.Item><Spinner size="sm"/></ListGroup.Item> :
                 proposals.length > 0 ? proposals.map(p => (
                    <ListGroup.Item key={p.id} className="d-flex justify-content-between align-items-center">
                        <div>
                            Proposal from <strong>{p.freelancer}</strong> for project "<strong>{p.project_title}</strong>" with a rate of <strong>₹{p.proposed_rate}</strong>.
                        </div>
                        <div>
                            <Button variant="success" size="sm" className="me-2" onClick={() => handleUpdateStatus(p.id, 'accepted')}>
                                <Check size={16} /> Accept
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleUpdateStatus(p.id, 'rejected')}>
                                <X size={16} /> Reject
                            </Button>
                        </div>
                    </ListGroup.Item>
                 )) : <ListGroup.Item>No proposals received yet.</ListGroup.Item>
                }
            </ListGroup>
        </Card>
    );

    const renderFreelancerDashboard = () => {
        const getStatusBadge = (status) => {
            switch (status) {
                case 'accepted':
                    return <Badge bg="success">Accepted</Badge>;
                case 'rejected':
                    return <Badge bg="danger">Rejected</Badge>;
                default:
                    return <Badge bg="warning">Pending</Badge>;
            }
        };

        return (
            <Card>
                <Card.Header as="h5">My Submitted Proposals</Card.Header>
                <ListGroup variant="flush">
                    {loading ? <ListGroup.Item><Spinner size="sm"/></ListGroup.Item> :
                     proposals.length > 0 ? proposals.map(p => (
                        <ListGroup.Item key={p.id} className="d-flex justify-content-between align-items-center">
                            <div>Proposal for "<strong>{p.project_title}</strong>"</div>
                            {getStatusBadge(p.status)}
                        </ListGroup.Item>
                     )) : <ListGroup.Item>You have not submitted any proposals.</ListGroup.Item>
                    }
                </ListGroup>
            </Card>
        );
    };

    return (
        <Container className="py-5">
            <h1 className="mb-4">Dashboard</h1>
            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Card.Title className="fs-2">Welcome back, {user.username}!</Card.Title>
                    <Card.Text>Your user type is: <Badge bg="success" className="fs-6">{user.user_type}</Badge></Card.Text>
                     {user.user_type === 'client' && <Button as={Link} to="/project/new" variant="primary"><PlusCircle size={16} className="me-1"/> Post New Project</Button>}
                </Card.Body>
            </Card>

            {user.user_type === 'client' ? renderClientDashboard() : renderFreelancerDashboard()}
        </Container>
    );
}

// --- Main App Component ---
function App() {
    return (
        <AuthProvider>
            <div className="d-flex flex-column" style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
                <AppNavbar />
                <main className="flex-grow-1">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/projects" element={<ProjectListPage />} />
                        <Route path="/project/new" element={<ProjectCreatePage />} />
                        <Route path="/project/:id" element={<ProjectDetailPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                    </Routes>
                </main>
            </div>
        </AuthProvider>
    );
}

export default App;