// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, BadgeDisplay } from '../App'; // <-- FIX: Import BadgeDisplay
import { Container, Card, Form, Button, Spinner, Alert, Badge, Row, Col, Image, ListGroup, Modal } from 'react-bootstrap';
import { User, Briefcase, DollarSign, Link as LinkIcon, Save, MapPin, Clock, Edit, Trash2, Plus, Image as ImageIcon, Tags } from 'lucide-react';

// Use environment variable for API URL or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'; // Base URL
const API_URL = `${API_BASE_URL}/api`; // API endpoint

// --- PortfolioItemModal ---
const PortfolioItemModal = ({ show, handleClose, item, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { axiosInstance } = useAuth();
    const fileInputRef = useRef();

    // Function to construct full image URL
    const getFullImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http') || url.startsWith('blob:')) return url; // Already full URL or blob URL
        return `${API_BASE_URL}${url}`; // Prepend base URL
    };

    useEffect(() => {
        if (item) {
            setTitle(item.title || '');
            setDescription(item.description || '');
            setLink(item.link || '');
            setCurrentImageUrl(getFullImageUrl(item.image)); // Use full URL
            setImageFile(null);
        } else {
            setTitle('');
            setDescription('');
            setLink('');
            setCurrentImageUrl('');
            setImageFile(null);
        }
        setError('');
    }, [item, show]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setCurrentImageUrl(URL.createObjectURL(file)); // Set local preview
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (link) formData.append('link', link);
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        try {
            let response;
            if (item) {
                response = await axiosInstance.patch(`/portfolio-items/${item.id}/`, formData);
            } else {
                response = await axiosInstance.post('/portfolio-items/', formData);
            }
            onSave(response.data);
            handleClose();
        } catch (err) {
            setError('Failed to save portfolio item.');
            console.error('Portfolio save error:', err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Title *</Form.Label>
                        <Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control as="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Link (Optional)</Form.Label>
                        <Form.Control type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://example.com" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Image (Optional)</Form.Label>
                        {currentImageUrl && (
                            <div className="mb-2">
                                <Image src={currentImageUrl} thumbnail width={100} />
                            </div>
                        )}
                        <Form.Control type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={loading}>
                    {loading ? <Spinner as="span" size="sm" /> : 'Save Item'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
// --- End PortfolioItemModal ---


const ProfilePage = () => {
    const { user, axiosInstance, updateUserContext } = useAuth(); // Get updateUserContext
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [skillsInput, setSkillsInput] = useState(''); // State for comma-separated skills
    const [profilePictureFile, setProfilePictureFile] = useState(null); // State for new picture file
    const [profilePicturePreview, setProfilePicturePreview] = useState(null); // State for preview

    // State for Portfolio Modal
    const [showPortfolioModal, setShowPortfolioModal] = useState(false);
    const [editingPortfolioItem, setEditingPortfolioItem] = useState(null);

    // Function to construct full image URL
     const getFullImageUrl = (url) => {
         if (!url) return null;
         if (url.startsWith('http') || url.startsWith('blob:')) return url; // Already full URL or blob URL
         return `${API_BASE_URL}${url}`; // Prepend base URL
     };


     const fetchProfile = async () => {
        if (!user || !user.profileId) {
             setError("Profile not found or user not loaded.");
             setLoading(false);
             return;
         };
        setLoading(true);
        setError('');
        try {
             const profileRes = await axiosInstance.get(`/profiles/${user.profileId}/`);
             setProfile(profileRes.data);
             setFormData({
                headline: profileRes.data.headline || '',
                bio: profileRes.data.bio || '',
                country: profileRes.data.country || '',
                timezone: profileRes.data.timezone || '',
                portfolio_link: profileRes.data.portfolio_link || '',
                hourly_rate: profileRes.data.hourly_rate || '',
             });
             setSkillsInput(profileRes.data.skills.map(skill => skill.name).join(', '));
             setProfilePictureFile(null);
             setProfilePicturePreview(null);
        } catch (err) {
            setError('Failed to fetch profile data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchProfile();
    }, [user, axiosInstance]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSkillsInputChange = (e) => {
        setSkillsInput(e.target.value);
    };

     const handleProfilePictureChange = (e) => {
         const file = e.target.files[0];
         if (file) {
            setProfilePictureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicturePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setProfilePictureFile(null);
            setProfilePicturePreview(null);
        }
     };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const dataToSend = new FormData();
         Object.keys(formData).forEach(key => {
             dataToSend.append(key, formData[key] === null || formData[key] === undefined ? '' : formData[key]);
         });

         const skillNames = skillsInput.split(',')
                              .map(name => name.trim())
                              .filter(name => name);
         skillNames.forEach(name => dataToSend.append('skill_names', name));

         if (profilePictureFile) {
             dataToSend.append('profile_picture', profilePictureFile);
         }

        try {
             const response = await axiosInstance.patch(`/profiles/${user.profileId}/`, dataToSend);
             setProfile(response.data);
             setFormData({
                headline: response.data.headline || '',
                bio: response.data.bio || '',
                country: response.data.country || '',
                timezone: response.data.timezone || '',
                portfolio_link: response.data.portfolio_link || '',
                hourly_rate: response.data.hourly_rate || '',
             });
             setSkillsInput(response.data.skills.map(s => s.name).join(', '));
             setProfilePictureFile(null);
             setProfilePicturePreview(null);
             setIsEditing(false);

             // Update user context with new picture URL
              updateUserContext({ profilePicture: response.data.profile_picture });
        } catch (err) {
            setError('Failed to update profile.');
            console.error('Profile update error:', err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

     // --- Portfolio Item Handlers ---
    const handleAddPortfolioItem = () => {
        setEditingPortfolioItem(null);
        setShowPortfolioModal(true);
    };

    const handleEditPortfolioItem = (item) => {
        setEditingPortfolioItem(item);
        setShowPortfolioModal(true);
    };

    const handleDeletePortfolioItem = async (itemId) => {
        if (window.confirm('Are you sure you want to delete this portfolio item?')) {
            try {
                await axiosInstance.delete(`/portfolio-items/${itemId}/`);
                fetchProfile(); // Refresh profile data
            } catch (err) {
                setError('Failed to delete portfolio item.');
                console.error('Portfolio delete error:', err.response?.data || err.message);
            }
        }
    };

     const handlePortfolioSave = (savedItem) => {
         fetchProfile(); // Refresh profile data
     };
     // --- End Portfolio Item Handlers ---


    if (loading && !profile) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (!profile && !loading) {
        const message = error || "Could not load profile data. Please try again later or contact support.";
        return <Container><Alert variant="warning">{message}</Alert></Container>;
    }

    const currentProfilePictureUrl = getFullImageUrl(profile?.profile_picture);
    const displayImageUrl = profilePicturePreview || currentProfilePictureUrl || `https://via.placeholder.com/100/007bff/FFFFFF?text=${user?.username?.charAt(0).toUpperCase() || 'U'}`;
    
    // --- BadgeDisplay is now imported ---

    return (
        <>
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={8}>
                        <Card className="shadow-sm">
                            <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                                <span><User className="me-2"/>Profile</span>
                                <Button variant={isEditing ? "outline-secondary" : "outline-primary"} size="sm" onClick={() => { setIsEditing(!isEditing); if (!isEditing) fetchProfile(); }}>
                                    {isEditing ? 'Cancel' : <><Edit size={14} className="me-1"/> Edit Profile</>}
                                </Button>
                            </Card.Header>
                            <Card.Body>
                                {/* Display general error only when NOT editing, handle form errors inside form */}
                                {error && !isEditing && <Alert variant="danger">{error}</Alert>}

                                {/* Show earned badges for the user */}
                                <div className="mb-3">
                                    <BadgeDisplay />
                                </div>

                                {isEditing ? (
                                    // --- EDITING FORM ---
                                    <Form onSubmit={handleSaveChanges}>
                                        {error && <Alert variant="danger">{error}</Alert>}
                                        
                                        <Form.Group className="mb-3 text-center">
                                            <Form.Label>Profile Picture</Form.Label>
                                            <div>
                                                <Image src={displayImageUrl} roundedCircle style={{ width: '100px', height: '100px', objectFit: 'cover', border: '1px solid #dee2e6' }} className="mb-2" />
                                            </div>
                                            <Form.Control type="file" accept="image/*" onChange={handleProfilePictureChange} />
                                        </Form.Group>

                                        <Form.Group className="mb-3">
                                            <Form.Label>Headline</Form.Label>
                                            <Form.Control type="text" name="headline" value={formData.headline} onChange={handleInputChange} placeholder="e.g., Senior React Developer" />
                                        </Form.Group>

                                        <Form.Group className="mb-3">
                                            <Form.Label>Bio</Form.Label>
                                            <Form.Control as="textarea" rows={5} name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us about yourself..." />
                                        </Form.Group>
                                        
                                        <Row>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Country</Form.Label>
                                                    <Form.Control type="text" name="country" value={formData.country} onChange={handleInputChange} placeholder="e.g., India" />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Timezone</Form.Label>
                                                    <Form.Control type="text" name="timezone" value={formData.timezone} onChange={handleInputChange} placeholder="e.g., Kolkata" />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        
                                        {profile.user_type === 'freelancer' && (
                                            <>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Hourly Rate (₹)</Form.Label>
                                                    <Form.Control type="number" step="0.01" name="hourly_rate" value={formData.hourly_rate} onChange={handleInputChange} placeholder="e.g., 2500.00" />
                                                </Form.Group>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Portfolio Link</Form.Label>
                                                    <Form.Control type="url" name="portfolio_link" value={formData.portfolio_link} onChange={handleInputChange} placeholder="https://your-portfolio.com" />
                                                </Form.Group>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Skills</Form.Label>
                                                    <Form.Control 
                                                        type="text" 
                                                        value={skillsInput} 
                                                        onChange={handleSkillsInputChange} 
                                                        placeholder="e.g., React, Node.js, Python"
                                                    />
                                                    <Form.Text muted>Enter skills separated by commas.</Form.Text>
                                                </Form.Group>
                                            </>
                                        )}
                                        <Button type="submit" variant="primary" disabled={loading}>
                                            <Save size={16} className="me-1" />
                                            {loading ? <Spinner as="span" size="sm" /> : 'Save Changes'}
                                        </Button>
                                    </Form>
                                ) : (
                                    // --- DISPLAY PROFILE ---
                                    <>
                                        <div className="text-center mb-4">
                                            <Image src={displayImageUrl} roundedCircle style={{ width: '100px', height: '100px', objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                            <h3 className="mt-3">{profile.user}</h3>
                                            <p className="text-muted">{profile.headline || 'No headline set'}</p>
                                        </div>
                                        <p><Briefcase size={16} className="me-2 text-primary" /> <Badge bg="info" className="fs-6">{profile.user_type}</Badge></p>
                                        <hr />
                                        <h5>About</h5>
                                        <p>{profile.bio || <span className="text-muted">No bio provided.</span>}</p>
                                        <Row className="mb-3">
                                            <Col md={6}><MapPin size={16} className="me-2 text-muted" /> {profile.country || <span className="text-muted">Country not set</span>}</Col>
                                            <Col md={6}><Clock size={16} className="me-2 text-muted" /> {profile.timezone || <span className="text-muted">Timezone not set</span>}</Col>
                                        </Row>
                                        {profile.portfolio_link && (
                                            <p><LinkIcon size={16} className="me-2 text-muted" /> <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer">Portfolio</a></p>
                                        )}
                                        
                                        {profile.user_type === 'freelancer' && (
                                            <>
                                                {profile.hourly_rate && (
                                                    <p><DollarSign size={16} className="me-2 text-success" /> <strong>Hourly Rate:</strong> {profile.hourly_rate ? `₹${profile.hourly_rate}` : <span className="text-muted">Not set</span>}</p>
                                                )}
                                                <hr />
                                                <h5><Tags size={16} className="me-1" /> Skills</h5>
                                                <div>
                                                    {profile.skills?.length > 0 ? profile.skills.map(skill => (
                                                        <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                                    )) : <span className="text-muted">No skills added.</span>}
                                                </div>
                                                <hr />
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <h5>Portfolio Items</h5>
                                                    <Button variant="outline-primary" size="sm" onClick={handleAddPortfolioItem}>
                                                        <Plus size={16} className="me-1" /> Add Item
                                                    </Button>
                                                </div>
                                                {profile.portfolio_items?.length > 0 ? (
                                                    <ListGroup variant="flush">
                                                        {profile.portfolio_items.map(item => (
                                                            <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-start">
                                                                <div className="me-auto">
                                                                    <div className="fw-bold">{item.title}</div>
                                                                    <small className="text-muted">{item.description}</small>
                                                                    {item.link && <><br /><a href={item.link} target="_blank" rel="noopener noreferrer"><LinkIcon size={12} /> View Link</a></>}
                                                                    {item.image && <><br /><Image src={getFullImageUrl(item.image)} thumbnail width={80} className="mt-1" /></>}
                                                                </div>
                                                                <div>
                                                                    <Button variant="link" size="sm" onClick={() => handleEditPortfolioItem(item)}><Edit size={16} /></Button>
                                                                    <Button variant="link" size="sm" className="text-danger" onClick={() => handleDeletePortfolioItem(item.id)}><Trash2 size={16} /></Button>
                                                                </div>
                                                            </ListGroup.Item>
                                                        ))}
                                                    </ListGroup>
                                                ) : (
                                                    <p className="text-muted">No portfolio items added yet.</p>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            {/* Portfolio Item Modal */}
            <PortfolioItemModal
                show={showPortfolioModal}
                handleClose={() => setShowPortfolioModal(false)}
                item={editingPortfolioItem}
                onSave={handlePortfolioSave}
            />
        </>
    );
};

export default ProfilePage;