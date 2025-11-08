// frontend/src/pages/ProjectEditPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { Save } from 'lucide-react';

const ProjectEditPage = () => {
    const { id: projectId } = useParams(); // Get project ID from URL
    const { user, axiosInstance } = useAuth();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [duration, setDuration] = useState('');
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [availableSkills, setAvailableSkills] = useState([]);
    const [timeSlot, setTimeSlot] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
        // New state for typed skill names
        const [newSkillNames, setNewSkillNames] = useState([]);
        const [newSkillInput, setNewSkillInput] = useState('');

    useEffect(() => {
        const fetchProjectAndSkills = async () => {
            setLoading(true);
            setError('');
            if (!user || user.user_type !== 'client') {
                setError("Unauthorized access.");
                setLoading(false);
                return;
            }
            try {
                const [projectRes, skillsRes] = await Promise.all([
                    axiosInstance.get(`/projects/${projectId}/`),
                    axiosInstance.get('/skills/')
                ]);

                const projectData = projectRes.data;
                 // Security check: ensure the current user owns this project
                if (projectData.client !== user.username) {
                     setError("You do not have permission to edit this project.");
                     setLoading(false);
                     setProject(null); // Clear potentially loaded project data
                     return;
                 }


                setProject(projectData);
                setTitle(projectData.title);
                setDescription(projectData.description);
                setBudget(projectData.budget);
                setDuration(projectData.duration || '');
                setTimeSlot(projectData.time_slot || '');
                setDeadline(projectData.deadline || '');
                setSelectedSkills(projectData.skills_required.map(skill => skill.id));
                setAvailableSkills(skillsRes.data.results || skillsRes.data);

            } catch (err) {
                setError('Failed to fetch project details or skills.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectAndSkills();
    }, [projectId, user, axiosInstance]);

    const handleSkillChange = (e) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
        setSelectedSkills(selectedIds);
    };

        // Handle new skill input
        const handleNewSkillInputChange = (e) => {
            setNewSkillInput(e.target.value);
        };

        const handleAddNewSkill = () => {
            const trimmed = newSkillInput.trim();
            if (trimmed && !newSkillNames.includes(trimmed)) {
                setNewSkillNames([...newSkillNames, trimmed]);
                setNewSkillInput('');
            }
        };

        const handleRemoveNewSkill = (name) => {
            setNewSkillNames(newSkillNames.filter(skill => skill !== name));
        };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
                await axiosInstance.put(`/projects/${projectId}/`, {
                    title,
                    description,
                    budget,
                    duration: duration || null,
                    skill_ids: selectedSkills,
                    new_skill_names: newSkillNames,
                    time_slot: timeSlot,
                    deadline: deadline || null,
                });
            alert('Project updated successfully!');
            navigate(`/project/${projectId}`); // Navigate back to project detail
        } catch (error) {
            setError(`Failed to update project: ${JSON.stringify(error.response?.data) || 'Server error'}`);
            console.error('Update project error:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !project) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    }

     if (!project) {
         // This can happen if the fetch failed or permission denied after initial load
         return <Container className="py-5"><Alert variant="warning">Project not found or access denied.</Alert></Container>;
     }


    return (
        <Container className="py-5" style={{ backgroundImage: 'url(/project-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <Row className="justify-content-center">
                <Col md={8}>
                    <h1>Edit Project: {project.title}</h1>
                    <Card className="p-4 shadow-sm">
                        {error && !loading && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3"><Form.Label>Project Title</Form.Label><Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} required /></Form.Group>
                            <Row>
                                <Col md={6}><Form.Group className="mb-3"><Form.Label>Budget (₹)</Form.Label><Form.Control type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required /></Form.Group></Col>
                                <Col md={6}><Form.Group className="mb-3"><Form.Label>Estimated Duration (days)</Form.Label><Form.Control type="number" value={duration} onChange={e => setDuration(e.target.value)} /></Form.Group></Col>
                            </Row>
                            <Form.Group className="mb-3">
                                <Form.Label>Skills Required</Form.Label>
                                <Form.Control as="select" multiple value={selectedSkills.map(String)} onChange={handleSkillChange} style={{ height: '150px' }}>
                                    {availableSkills.map(skill => (
                                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                                    ))}
                                </Form.Control>
                                <Form.Text muted>Hold Ctrl (or Cmd) to select multiple.</Form.Text>
                                {/* New skill input */}
                                <div className="mt-3">
                                    <Form.Label>Add New Skills</Form.Label>
                                    <InputGroup>
                                        <Form.Control type="text" value={newSkillInput} onChange={handleNewSkillInputChange} placeholder="Type a skill and press Add" />
                                        <Button variant="outline-primary" onClick={handleAddNewSkill}>Add</Button>
                                    </InputGroup>
                                    <div className="mt-2">
                                        {newSkillNames.map((name, idx) => (
                                            <Badge key={idx} bg="info" className="me-2">
                                                {name} <Button variant="link" size="sm" className="p-0 ms-1" onClick={() => handleRemoveNewSkill(name)}>&times;</Button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </Form.Group>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Preferred Time Slot</Form.Label>
                                        <Form.Control type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Project Deadline</Form.Label>
                                        <Form.Control type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                                        <Form.Text muted>Set deadline for project completion</Form.Text>
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Button type="submit" variant="primary" disabled={loading}>
                                <Save size={16} className="me-1"/>
                                {loading ? <Spinner as="span" size="sm" /> : 'Save Changes'}
                            </Button>
                            <Button variant="secondary" className="ms-2" onClick={() => navigate(`/project/${projectId}`)}>
                                Cancel
                            </Button>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ProjectEditPage;