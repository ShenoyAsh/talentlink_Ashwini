// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Container, Card, Form, Button, Spinner, Alert, Badge, Row, Col, Image, ListGroup, Modal } from 'react-bootstrap';
import { User, Briefcase, DollarSign, Link as LinkIcon, Save, MapPin, Clock, Edit, Trash2, Plus, Image as ImageIcon, Tags } from 'lucide-react'; // Added Tags icon

// Use environment variable for API URL or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'; // Base URL
const API_URL = `${API_BASE_URL}/api`; // API endpoint

// --- PortfolioItemModal remains the same ---
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

    useEffect(() => {
        if (item) {
            setTitle(item.title || '');
            setDescription(item.description || '');
            setLink(item.link || '');
            // Construct full image URL if relative path is stored
            setCurrentImageUrl(item.image ? (item.image.startsWith('http') ? item.image : `${API_BASE_URL}${item.image}`) : '');
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
        setImageFile(e.target.files[0]);
         setCurrentImageUrl('');
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
        } else if (!currentImageUrl && item?.image) {
             // If API expects explicit null/empty to delete, handle here
             // For DRF ImageField, omitting it on PATCH usually keeps it,
             // sending null might clear it, sending '' might cause validation error.
             // Check backend API behavior for clearing images.
             // Let's assume omitting it keeps it, and a separate 'delete' action is needed if required.
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

     // Function to construct full image URL
     const getFullImageUrl = (url) => {
         if (!url) return null;
         if (url.startsWith('http') || url.startsWith('blob:')) return url; // Already full URL or blob URL
         return `${API_BASE_URL}${url}`; // Prepend base URL
     };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form>
                   {/* Form Groups remain the same */}
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
                         {currentImageUrl && !imageFile && (
                            <div className="mb-2">
                                <Image src={getFullImageUrl(currentImageUrl)} thumbnail width={100} />
                                <Button variant="outline-danger" size="sm" className="ms-2" onClick={() => { setCurrentImageUrl(''); }}>Remove Current Image</Button>
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
    // const [availableSkills, setAvailableSkills] = useState([]); // No longer needed for select
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
             // Fetch profile only
             const profileRes = await axiosInstance.get(`/profiles/${user.profileId}/`);
             setProfile(profileRes.data);
             setFormData({ // Set initial form data (excluding file and skills)
                headline: profileRes.data.headline || '',
                bio: profileRes.data.bio || '',
                country: profileRes.data.country || '',
                timezone: profileRes.data.timezone || '',
                portfolio_link: profileRes.data.portfolio_link || '',
                hourly_rate: profileRes.data.hourly_rate || '',
             });
             // Set initial skills input as comma-separated string
             setSkillsInput(profileRes.data.skills.map(skill => skill.name).join(', '));
             setProfilePictureFile(null); // Clear any previous file selection
             setProfilePicturePreview(null); // Clear preview

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

    // Handle changes in the skills text input
    const handleSkillsInputChange = (e) => {
        setSkillsInput(e.target.value);
    };

     const handleProfilePictureChange = (e) => {
         const file = e.target.files[0];
         if (file) {
            setProfilePictureFile(file);
            // Create a preview URL
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
             // Ensure null/empty values are handled if needed by backend, send empty strings for now
             dataToSend.append(key, formData[key] === null || formData[key] === undefined ? '' : formData[key]);
         });

         // Process skills input into an array of names
         const skillNames = skillsInput.split(',')
                              .map(name => name.trim())
                              .filter(name => name); // Remove empty strings
         // Append each skill name individually if backend expects list field
         skillNames.forEach(name => dataToSend.append('skill_names', name));
         // If backend expects a single JSON stringified array:
         // dataToSend.append('skill_names', JSON.stringify(skillNames));

         // Append profile picture file ONLY if a new one was selected
         if (profilePictureFile) {
             dataToSend.append('profile_picture', profilePictureFile);
         }


        try {
             const response = await axiosInstance.patch(`/profiles/${user.profileId}/`, dataToSend);
             setProfile(response.data); // Update profile state with response
             setFormData({ // Reset form data based on response
                headline: response.data.headline || '',
                bio: response.data.bio || '',
                country: response.data.country || '',
                timezone: response.data.timezone || '',
                portfolio_link: response.data.portfolio_link || '',
                hourly_rate: response.data.hourly_rate || '',
             });
             setSkillsInput(response.data.skills.map(s => s.name).join(', ')); // Update skills input
             setProfilePictureFile(null); // Clear file input state
             setProfilePicturePreview(null); // Clear preview
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

     // --- Portfolio Item Handlers (remain the same) ---
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

     // Handle case where user exists but profile fetch failed or profileId missing
    if (!profile && !loading) {
         // Check for specific error message or just show generic
         const message = error || "Could not load profile data. Please try again later or contact support.";
        return <Container><Alert variant="warning">{message}</Alert></Container>;
    }


     const currentProfilePictureUrl = getFullImageUrl(profile?.profile_picture);
     const displayImageUrl = profilePicturePreview || currentProfilePictureUrl || `https://via.placeholder.com/100/007bff/FFFFFF?text=${user?.username?.charAt(0).toUpperCase() || 'U'}`;


    return (
        <>
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={8}>
                        <Card className="shadow-sm">
                            <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                                <span><User className="me-2"/>Profile</span>
                                <Button variant={isEditing ? "outline-secondary" : "outline-primary"} size="sm" onClick={() => { setIsEditing(!isEditing); if (!isEditing) fetchProfile(); }}> {/* Refetch data on Cancel */}
                                    {isEditing ? 'Cancel' : <><Edit size={14} className="me-1"/> Edit Profile</>}
                                </Button>
                            </Card.Header>
                            <Card.Body>
                                {/* Display general error only when NOT editing, handle form errors inside form */}
                                {error && !isEditing && <Alert variant="danger">{error}</Alert>}

                                {isEditing ? (
                                    <Form onSubmit={handleSaveChanges}>
                                         <Form.Group className="mb-3 text-center">
                                             <Image
                                                 src={displayImageUrl}
                                                 roundedCircle
                                                 style={{ width: '100px', height: '100px', objectFit: 'cover', marginBottom: '10px', cursor: 'pointer', border: '1px solid #dee2e6' }}
                                                 onClick={() => document.getElementById('profilePictureInput').click()}
                                            />
                                            <Form.Control
                                                id="profilePictureInput"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleProfilePictureChange}
                                                style={{ display: 'none' }}
                                            />
                                             <Form.Text muted>Click image to change</Form.Text>
                                             {/* Display form-specific error here if needed */}
                                              {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
                                        </Form.Group>

                                        {/* Other Form Groups remain similar */}
                                        <Form.Group className="mb-3"><Form.Label>Headline</Form.Label><Form.Control type="text" name="headline" value={formData.headline || ''} onChange={handleInputChange} placeholder="e.g., Senior Web Developer"/></Form.Group>
                                        <Form.Group className="mb-3"><Form.Label>Bio</Form.Label><Form.Control as="textarea" rows={4} name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Tell us about yourself..."/></Form.Group>
                                        <Row>
                                            <Col md={6}><Form.Group className="mb-3"><Form.Label>Country</Form.Label><Form.Control type="text" name="country" value={formData.country || ''} onChange={handleInputChange} /></Form.Group></Col>
                                            <Col md={6}><Form.Group className="mb-3"><Form.Label>Timezone</Form.Label><Form.Control type="text" name="timezone" value={formData.timezone || ''} onChange={handleInputChange} placeholder="e.g., Asia/Kolkata"/></Form.Group></Col>
                                        </Row>
                                        <Form.Group className="mb-3"><Form.Label>Portfolio Link (General)</Form.Label><Form.Control type="url" name="portfolio_link" value={formData.portfolio_link || ''} onChange={handleInputChange} placeholder="https://yourportfolio.com"/></Form.Group>

                                        {user?.user_type === 'freelancer' && (
                                            <>
                                                <Form.Group className="mb-3"><Form.Label>Hourly Rate (₹)</Form.Label><Form.Control type="number" step="0.01" name="hourly_rate" value={formData.hourly_rate || ''} onChange={handleInputChange} placeholder="e.g., 2500.00"/></Form.Group>
                                                 {/* Skills Text Input */}
                                                 <Form.Group className="mb-3">
                                                    <Form.Label><Tags size={16} className="me-1"/> Skills</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={skillsInput}
                                                        onChange={handleSkillsInputChange}
                                                        placeholder="Enter skills separated by commas"
                                                    />
                                                    <Form.Text muted>Separate skills with commas (e.g., React, Node.js, Python).</Form.Text>
                                                </Form.Group>
                                            </>
                                        )}
                                        <Button type="submit" variant="primary" disabled={loading}>
                                            <Save size={16} className="me-2" />
                                            {loading ? <Spinner as="span" size="sm" /> : 'Save Changes'}
                                        </Button>
                                    </Form>
                                ) : (
                                    <>
                                        <div className="text-center mb-4">
                                            <Image src={displayImageUrl} roundedCircle style={{ width: '100px', height: '100px', objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                            <h3 className="mt-3">{user?.username}</h3> {/* Display username from context */}
                                            <p className="text-muted">{profile?.headline || 'No headline set'}</p>
                                        </div>
                                        <p><Briefcase size={16} className="me-2 text-primary" /> <Badge bg="info" className="fs-6">{profile?.user_type}</Badge></p>
                                        <hr/>
                                        <h5>About</h5>
                                        <p>{profile?.bio || <span className="text-muted">No bio provided.</span>}</p>
                                        <Row className="mb-3">
                                             <Col md={6}><MapPin size={16} className="me-2 text-muted" /> {profile?.country || <span className="text-muted">Country not set</span>}</Col>
                                             <Col md={6}><Clock size={16} className="me-2 text-muted" /> {profile?.timezone || <span className="text-muted">Timezone not set</span>}</Col>
                                        </Row>
                                        {profile?.portfolio_link && (
                                            <p><LinkIcon size={16} className="me-2 text-muted" /> <a href={profile?.portfolio_link} target="_blank" rel="noopener noreferrer">Portfolio</a></p>
                                        )}
                                        {profile?.user_type === 'freelancer' && (
                                            <>
                                                <p><DollarSign size={16} className="me-2 text-success" /> <strong>Hourly Rate:</strong> {profile?.hourly_rate ? `₹${profile.hourly_rate}` : <span className="text-muted">Not set</span>}</p>
                                                <hr/>
                                                <h5><Tags size={16} className="me-1"/> Skills</h5>
                                                <div>
                                                    {profile?.skills?.length > 0 ? profile.skills.map(skill => (
                                                        <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                                    )) : <span className="text-muted">No skills added.</span>}
                                                </div>
                                                <hr/>
                                                 {/* Portfolio Items Section (remains the same) */}
                                                 <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <h5>Portfolio Items</h5>
                                                    <Button variant="outline-success" size="sm" onClick={handleAddPortfolioItem}>
                                                        <Plus size={16} className="me-1"/> Add Item
                                                    </Button>
                                                </div>
                                                 {profile?.portfolio_items?.length > 0 ? (
                                                    <ListGroup variant="flush">
                                                        {profile.portfolio_items.map(item => (
                                                            <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-start">
                                                                 <div className="me-auto">
                                                                     <div className="fw-bold">{item.title}</div>
                                                                     <small className="text-muted">{item.description}</small>
                                                                     {item.link && <><br/><a href={item.link} target="_blank" rel="noopener noreferrer"><LinkIconLucide size={12} /> View Link</a></>}
                                                                      {item.image && <><br/><Image src={getFullImageUrl(item.image)} thumbnail width={80} className="mt-1" /></>}
                                                                 </div>
                                                                <div>
                                                                     <Button variant="link" size="sm" onClick={() => handleEditPortfolioItem(item)} title="Edit Item"><Edit size={16} /></Button>
                                                                    <Button variant="link" size="sm" className="text-danger" onClick={() => handleDeletePortfolioItem(item.id)} title="Delete Item"><Trash2 size={16} /></Button>
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