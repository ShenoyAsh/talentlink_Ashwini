// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Container, Card, Form, Button, Spinner, Alert, Badge, Row, Col, Image, ListGroup, Modal } from 'react-bootstrap';
import { User, Briefcase, DollarSign, Link as LinkIcon, Save, MapPin, Clock, Edit, Trash2, Plus, Image as ImageIcon } from 'lucide-react'; // Added Edit, Trash2, Plus

// New component for managing a single Portfolio Item (in Modal)
const PortfolioItemModal = ({ show, handleClose, item, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [imageFile, setImageFile] = useState(null); // For file upload
    const [currentImageUrl, setCurrentImageUrl] = useState(''); // To show existing image
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { axiosInstance } = useAuth();
    const fileInputRef = useRef();

    useEffect(() => {
        if (item) {
            setTitle(item.title || '');
            setDescription(item.description || '');
            setLink(item.link || '');
            setCurrentImageUrl(item.image || ''); // Store existing image URL
            setImageFile(null); // Reset file input
        } else {
            // Reset for new item
            setTitle('');
            setDescription('');
            setLink('');
            setCurrentImageUrl('');
            setImageFile(null);
        }
        setError(''); // Clear error when modal opens or item changes
    }, [item, show]);

    const handleFileChange = (e) => {
        setImageFile(e.target.files[0]);
         setCurrentImageUrl(''); // Clear current image URL when new file is selected
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');

        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (link) formData.append('link', link);
        // Only append image if a new one is selected OR if clearing existing image without new one
        if (imageFile) {
            formData.append('image', imageFile);
        } else if (!currentImageUrl && item?.image) {
            // If currentImageUrl is cleared and there was an existing image,
            // send empty 'image' field if API supports clearing it this way.
            // Adjust based on backend implementation (might need specific flag or null value)
            // formData.append('image', ''); // Or handle clearing logic if different
        }


        try {
            let response;
            if (item) {
                // Update existing item (PATCH or PUT)
                // Use PATCH if only sending changed fields, PUT if sending all fields
                 response = await axiosInstance.patch(`/portfolio-items/${item.id}/`, formData);
            } else {
                // Create new item (POST)
                response = await axiosInstance.post('/portfolio-items/', formData);
            }
            onSave(response.data); // Pass back the saved/created item
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
                         {currentImageUrl && !imageFile && (
                            <div className="mb-2">
                                <Image src={currentImageUrl} thumbnail width={100} />
                                <Button variant="outline-danger" size="sm" className="ms-2" onClick={() => { setCurrentImageUrl(''); /* Handle image removal on save if needed */ }}>Remove Image</Button>
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


const ProfilePage = () => {
    const { user, axiosInstance } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [availableSkills, setAvailableSkills] = useState([]); // For skill selection
    const [selectedSkills, setSelectedSkills] = useState([]); // IDs of selected skills

    // State for Portfolio Modal
    const [showPortfolioModal, setShowPortfolioModal] = useState(false);
    const [editingPortfolioItem, setEditingPortfolioItem] = useState(null); // null for new, item object for edit

     const fetchProfile = async () => {
        if (!user || !user.profileId) return; // Check if profileId exists
        setLoading(true); // Ensure loading is true at the start
        setError('');
        try {
             // Fetch profile and skills concurrently
             const [profileRes, skillsRes] = await Promise.all([
                axiosInstance.get(`/profiles/${user.profileId}/`),
                axiosInstance.get('/skills/') // Fetch all available skills for editing
            ]);

            setProfile(profileRes.data);
            setFormData(profileRes.data);
            setSelectedSkills(profileRes.data.skills.map(skill => skill.id)); // Set initial selected skills
            setAvailableSkills(skillsRes.data.results || skillsRes.data); // Handle pagination
        } catch (err) {
            setError('Failed to fetch profile data or skills.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchProfile();
    }, [user, axiosInstance]); // Depend on user and axiosInstance

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSkillChange = (e) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
        setSelectedSkills(selectedIds);
    };

     const handleProfilePictureChange = (e) => {
         if (e.target.files[0]) {
            setFormData({ ...formData, profile_picture_file: e.target.files[0] });
        }
     };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Use FormData if profile picture is being uploaded
         const dataToSend = new FormData();
         Object.keys(formData).forEach(key => {
             // Skip the file object, append it separately
             if (key !== 'profile_picture_file' && key !== 'skills' && key !== 'portfolio_items' && formData[key] !== null && formData[key] !== undefined) {
                dataToSend.append(key, formData[key]);
             }
         });

         // Append skill IDs
         selectedSkills.forEach(id => dataToSend.append('skill_ids', id));

         // Append profile picture file if it exists
         if (formData.profile_picture_file) {
             dataToSend.append('profile_picture', formData.profile_picture_file);
         }


        try {
             // Use PUT or PATCH - PUT requires all fields, PATCH only changed ones.
             // Using PATCH is generally more flexible.
             const response = await axiosInstance.patch(`/profiles/${user.profileId}/`, dataToSend); // Send FormData
             setProfile(response.data); // Update profile state with response
             setFormData(response.data); // Update form data as well
             setSelectedSkills(response.data.skills.map(s => s.id)); // Update selected skills from response
             setIsEditing(false);
             // Optionally update user context if profile picture changed
             // const updatedUser = { ...user, profilePicture: response.data.profile_picture };
             // localStorage.setItem('user', JSON.stringify(updatedUser));
             // Call a context update function if available
        } catch (err) {
            setError('Failed to update profile.');
            console.error('Profile update error:', err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

     // --- Portfolio Item Handlers ---
    const handleAddPortfolioItem = () => {
        setEditingPortfolioItem(null); // Ensure it's for adding
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
                // Refresh profile data to show updated list
                fetchProfile();
            } catch (err) {
                setError('Failed to delete portfolio item.');
                console.error('Portfolio delete error:', err.response?.data || err.message);
            }
        }
    };

     const handlePortfolioSave = (savedItem) => {
         // Refresh profile data after saving portfolio item
         fetchProfile();
     };


    if (loading && !profile) { // Show loading only if profile is not yet loaded
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    // Handle case where user exists but profile fetch failed or profileId missing
    if (!profile && !loading) {
         // This might happen if registration created user but not profile, or profileId is missing in context
         // You might want to redirect or show a specific message
        return <Container><Alert variant="warning">Could not load profile data. Please try again later or contact support.</Alert></Container>;
    }


    return (
        <>
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={8}>
                        <Card className="shadow-sm">
                            <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                                <span><User className="me-2"/>Profile</span>
                                <Button variant={isEditing ? "outline-secondary" : "outline-primary"} size="sm" onClick={() => setIsEditing(!isEditing)}>
                                    {isEditing ? 'Cancel' : <><Edit size={14} className="me-1"/> Edit Profile</>}
                                </Button>
                            </Card.Header>
                            <Card.Body>
                                {error && <Alert variant="danger">{error}</Alert>}
                                {isEditing ? (
                                    <Form onSubmit={handleSaveChanges}>
                                        {/* Profile Picture Upload */}
                                         <Form.Group className="mb-3 text-center">
                                             <Image
                                                 src={formData.profile_picture_file ? URL.createObjectURL(formData.profile_picture_file) : (profile?.profile_picture || `https://via.placeholder.com/100/007bff/FFFFFF?text=${user?.username?.charAt(0).toUpperCase() || 'U'}`)}
                                                 roundedCircle
                                                 style={{ width: '100px', height: '100px', objectFit: 'cover', marginBottom: '10px', cursor: 'pointer' }}
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
                                        </Form.Group>

                                        <Form.Group className="mb-3">
                                            <Form.Label>Headline</Form.Label>
                                            <Form.Control type="text" name="headline" value={formData.headline || ''} onChange={handleInputChange} placeholder="e.g., Senior Web Developer"/>
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Bio</Form.Label>
                                            <Form.Control as="textarea" rows={4} name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Tell us about yourself..."/>
                                        </Form.Group>
                                        <Row>
                                            <Col md={6}><Form.Group className="mb-3"><Form.Label>Country</Form.Label><Form.Control type="text" name="country" value={formData.country || ''} onChange={handleInputChange} /></Form.Group></Col>
                                            <Col md={6}><Form.Group className="mb-3"><Form.Label>Timezone</Form.Label><Form.Control type="text" name="timezone" value={formData.timezone || ''} onChange={handleInputChange} placeholder="e.g., Asia/Kolkata"/></Form.Group></Col>
                                        </Row>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Portfolio Link (General)</Form.Label>
                                            <Form.Control type="url" name="portfolio_link" value={formData.portfolio_link || ''} onChange={handleInputChange} placeholder="https://yourportfolio.com"/>
                                        </Form.Group>
                                        {user?.user_type === 'freelancer' && (
                                            <>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Hourly Rate (₹)</Form.Label>
                                                    <Form.Control type="number" step="0.01" name="hourly_rate" value={formData.hourly_rate || ''} onChange={handleInputChange} placeholder="e.g., 2500.00"/>
                                                </Form.Group>
                                                 <Form.Group className="mb-3">
                                                    <Form.Label>Skills (Select multiple)</Form.Label>
                                                    <Form.Control as="select" multiple value={selectedSkills.map(String)} onChange={handleSkillChange} style={{ height: '150px' }}>
                                                        {availableSkills.map(skill => (
                                                            <option key={skill.id} value={skill.id}>{skill.name}</option>
                                                        ))}
                                                    </Form.Control>
                                                    <Form.Text muted>Hold Ctrl (or Cmd on Mac) to select multiple.</Form.Text>
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
                                            <Image src={profile?.profile_picture || `https://via.placeholder.com/100/007bff/FFFFFF?text=${user?.username?.charAt(0).toUpperCase() || 'U'}`} roundedCircle style={{ width: '100px', height: '100px', objectFit: 'cover' }} />
                                            <h3 className="mt-3">{profile?.user}</h3>
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
                                                <h5>Skills</h5>
                                                <div>
                                                    {profile?.skills?.length > 0 ? profile.skills.map(skill => (
                                                        <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                                    )) : <span className="text-muted">No skills added.</span>}
                                                </div>
                                                <hr/>
                                                 {/* Portfolio Items Section */}
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
                                                                     {item.link && <><br/><a href={item.link} target="_blank" rel="noopener noreferrer"><LinkIcon size={12} /> View Link</a></>}
                                                                      {item.image && <><br/><Image src={item.image} thumbnail width={80} className="mt-1" /></>}
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