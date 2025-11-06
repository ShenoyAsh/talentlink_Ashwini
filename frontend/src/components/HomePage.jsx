// frontend/src/components/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { 
    Briefcase, Users, Award, Shield, Zap, TrendingUp, 
    Globe, CheckCircle, ArrowRight, Star, Clock, DollarSign 
} from 'lucide-react';

const HomePage = () => {
    const features = [
        {
            icon: <Briefcase size={40} />,
            title: 'Find Quality Work',
            description: 'Connect with clients and access thousands of high-quality projects.',
            color: '#667eea'
        },
        {
            icon: <Users size={40} />,
            title: 'Hire Top Talent',
            description: 'Find skilled freelancers for your projects quickly and efficiently.',
            color: '#764ba2'
        },
        {
            icon: <Shield size={40} />,
            title: 'Secure Payments',
            description: 'Protected transactions with milestone-based payments and escrow.',
            color: '#f093fb'
        },
        {
            icon: <Award size={40} />,
            title: 'Build Your Reputation',
            description: 'Earn reviews and badges to showcase your expertise.',
            color: '#4facfe'
        },
        {
            icon: <Zap size={40} />,
            title: 'Fast & Efficient',
            description: 'Streamlined process from posting to completing projects.',
            color: '#f5576c'
        },
        {
            icon: <TrendingUp size={40} />,
            title: 'Grow Your Business',
            description: 'Scale your freelancing career or find the perfect team.',
            color: '#43e97b'
        }
    ];

    const stats = [
        { number: '10K+', label: 'Active Freelancers', icon: <Users size={24} /> },
        { number: '5K+', label: 'Completed Projects', icon: <CheckCircle size={24} /> },
        { number: '98%', label: 'Satisfaction Rate', icon: <Star size={24} /> },
        { number: '24/7', label: 'Support Available', icon: <Clock size={24} /> }
    ];

    const howItWorks = [
        {
            step: 1,
            title: 'Sign Up',
            description: 'Create your account as a freelancer or client',
            icon: <Users size={30} />
        },
        {
            step: 2,
            title: 'Post or Browse',
            description: 'Clients post projects, freelancers browse opportunities',
            icon: <Briefcase size={30} />
        },
        {
            step: 3,
            title: 'Connect & Collaborate',
            description: 'Submit proposals, chat, and work together',
            icon: <Globe size={30} />
        },
        {
            step: 4,
            title: 'Get Paid',
            description: 'Complete milestones and get paid securely',
            icon: <DollarSign size={30} />
        }
    ];

    return (
        <div className="homepage">
            {/* Hero Section */}
            <section className="hero-section-enhanced">
                <Container>
                    <Row className="align-items-center min-vh-75 py-5">
                        <Col lg={6} className="text-white">
                            <h1 className="display-3 fw-bold mb-4 animate-fade-in">
                                Connect Talent with Opportunity
                            </h1>
                            <p className="lead mb-4 fs-5">
                                The premier platform connecting skilled freelancers with businesses 
                                seeking exceptional talent. Build your career or find your dream team.
                            </p>
                            <div className="d-flex gap-3 flex-wrap">
                                <Button as={Link} to="/register" variant="light" size="lg" className="px-4 py-3 fw-bold">
                                    Get Started Free <ArrowRight className="ms-2" size={20} />
                                </Button>
                                <Button as={Link} to="/projects" variant="outline-light" size="lg" className="px-4 py-3">
                                    Browse Projects
                                </Button>
                            </div>
                            <div className="mt-5 d-flex gap-4 flex-wrap">
                                {stats.map((stat, idx) => (
                                    <div key={idx} className="text-center">
                                        <div className="text-white-50 mb-2">{stat.icon}</div>
                                        <h3 className="fw-bold mb-1">{stat.number}</h3>
                                        <p className="mb-0 text-white-50 small">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </Col>
                        <Col lg={6} className="text-center">
                            <div className="hero-image-placeholder p-5">
                                <div className="bg-white bg-opacity-10 rounded-4 p-5 backdrop-blur">
                                    <Briefcase size={120} className="text-white" />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Features Section */}
            <section className="py-5 bg-light">
                <Container>
                    <div className="text-center mb-5">
                        <h2 className="display-5 fw-bold gradient-text mb-3">Why Choose TalentLink?</h2>
                        <p className="lead text-muted">Everything you need to succeed in the freelance marketplace</p>
                    </div>
                    <Row className="g-4">
                        {features.map((feature, idx) => (
                            <Col md={6} lg={4} key={idx}>
                                <Card className="h-100 shadow-sm border-0 feature-card animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                    <Card.Body className="p-4 text-center">
                                        <div className="mb-3" style={{ color: feature.color }}>
                                            {feature.icon}
                                        </div>
                                        <Card.Title className="h5 mb-3">{feature.title}</Card.Title>
                                        <Card.Text className="text-muted">{feature.description}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* How It Works */}
            <section className="py-5">
                <Container>
                    <div className="text-center mb-5">
                        <h2 className="display-5 fw-bold gradient-text mb-3">How It Works</h2>
                        <p className="lead text-muted">Simple steps to get started</p>
                    </div>
                    <Row className="g-4">
                        {howItWorks.map((item, idx) => (
                            <Col md={6} lg={3} key={idx}>
                                <Card className="h-100 shadow-sm border-0 text-center p-4 how-it-works-card">
                                    <div className="mb-3">
                                        <Badge bg="primary" className="rounded-circle p-3 mb-3">
                                            <span className="fs-4">{item.step}</span>
                                        </Badge>
                                        <div className="text-primary">{item.icon}</div>
                                    </div>
                                    <Card.Title className="h5">{item.title}</Card.Title>
                                    <Card.Text className="text-muted">{item.description}</Card.Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* CTA Section */}
            <section className="py-5 bg-gradient-primary text-white">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={8}>
                            <h2 className="display-5 fw-bold mb-3">Ready to Get Started?</h2>
                            <p className="lead mb-0">
                                Join thousands of freelancers and clients building success on TalentLink
                            </p>
                        </Col>
                        <Col lg={4} className="text-lg-end mt-4 mt-lg-0">
                            <Button as={Link} to="/register" variant="light" size="lg" className="px-5 py-3 fw-bold">
                                Create Free Account <ArrowRight className="ms-2" size={20} />
                            </Button>
                        </Col>
                    </Row>
                </Container>
            </section>
        </div>
    );
};

export default HomePage;

