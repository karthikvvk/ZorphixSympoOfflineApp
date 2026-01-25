import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, COLLEGES, DEGREES, DEPARTMENTS, YEARS } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { insertParticipant } from '../services/sqlite';
import { registerUserOnSpot } from '../services/firebase'; // Ensure this is exported and available
import { PAID_EVENTS } from '../navigation/types';
import QRCode from 'react-native-qrcode-svg';
import { Image } from 'react-native';

type RegistrationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Registration'>;
type RegistrationScreenRouteProp = RouteProp<RootStackParamList, 'Registration'>;

type Props = {
    navigation: RegistrationScreenNavigationProp;
    route: RegistrationScreenRouteProp;
};

interface DropdownProps {
    label: string;
    value: string;
    options: string[];
    onSelect: (value: string) => void;
    placeholder: string;
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onSelect, placeholder }) => {
    const [visible, setVisible] = useState(false);

    return (
        <View style={styles.formGroup}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setVisible(true)}
            >
                <Text style={[styles.dropdownText, !value && styles.placeholder]}>
                    {value || placeholder}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{label}</Text>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.modalItem, value === item && styles.modalItemSelected]}
                                    onPress={() => {
                                        onSelect(item);
                                        setVisible(false);
                                    }}
                                >
                                    <Text style={[styles.modalItemText, value === item && styles.modalItemTextSelected]}>
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const RegistrationScreen: React.FC<Props> = ({ navigation, route }) => {
    const { eventContext } = useEventContext();
    const prefilledUID = route.params?.prefilledUID;
    const prefilledName = route.params?.prefilledName;
    const prefilledEmail = route.params?.prefilledEmail;
    const prefilledPhone = route.params?.prefilledPhone;
    const prefilledCollege = route.params?.prefilledCollege;
    const prefilledDept = route.params?.prefilledDept;
    const prefilledYear = route.params?.prefilledYear;

    // Form state - initialize with pre-filled values if available
    const [name, setName] = useState(prefilledName || '');
    const [email, setEmail] = useState(prefilledEmail || '');
    const [phone, setPhone] = useState(prefilledPhone || '');
    const [college, setCollege] = useState(prefilledCollege || '');
    const [collegeOther, setCollegeOther] = useState('');
    const [degree, setDegree] = useState('');
    const [degreeOther, setDegreeOther] = useState('');
    const [department, setDepartment] = useState(prefilledDept || '');
    const [departmentOther, setDepartmentOther] = useState('');
    const [year, setYear] = useState(prefilledYear || '');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [registeredData, setRegisteredData] = useState<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingRegistration, setPendingRegistration] = useState<any>(null);

    // Update form fields when prefilled values change (handles navigation re-use)
    React.useEffect(() => {
        console.log('📥 RegistrationScreen: Received params:', {
            prefilledUID, prefilledName, prefilledEmail, prefilledPhone, prefilledCollege, prefilledDept, prefilledYear
        });

        if (prefilledName) {
            console.log(`✅ Auto-filling name: ${prefilledName}`);
            setName(prefilledName);
        }
        if (prefilledEmail) {
            console.log(`✅ Auto-filling email: ${prefilledEmail}`);
            setEmail(prefilledEmail);
        }
        if (prefilledPhone) {
            console.log(`✅ Auto-filling phone: ${prefilledPhone}`);
            setPhone(prefilledPhone);
        }
        if (prefilledCollege) {
            console.log(`✅ Auto-filling college: ${prefilledCollege}`);
            setCollege(prefilledCollege);
        }
        if (prefilledDept) {
            console.log(`✅ Auto-filling dept: ${prefilledDept}`);
            setDepartment(prefilledDept);
        }
        if (prefilledYear) {
            console.log(`✅ Auto-filling year: ${prefilledYear}`);
            setYear(prefilledYear);
        }
    }, [
        prefilledName,
        prefilledEmail,
        prefilledPhone,
        prefilledCollege,
        prefilledDept,
        prefilledYear
    ]);

    const validateForm = (): boolean => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter full name');
            return false;
        }
        if (!email.trim() || !email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email');
            return false;
        }
        if (!phone.trim() || phone.length !== 10) {
            Alert.alert('Error', 'Please enter a valid 10-digit phone number');
            return false;
        }
        if (!college) {
            Alert.alert('Error', 'Please select a college');
            return false;
        }
        if (college === 'Other' && !collegeOther.trim()) {
            Alert.alert('Error', 'Please enter your college name');
            return false;
        }
        if (!degree) {
            Alert.alert('Error', 'Please select a degree');
            return false;
        }
        if (degree === 'Other' && !degreeOther.trim()) {
            Alert.alert('Error', 'Please enter your degree');
            return false;
        }
        if (!department) {
            Alert.alert('Error', 'Please select a department');
            return false;
        }
        if (department === 'Other' && !departmentOther.trim()) {
            Alert.alert('Error', 'Please enter your department');
            return false;
        }
        if (!year) {
            Alert.alert('Error', 'Please select year of study');
            return false;
        }
        return true;
    };

    const finalizeRegistration = async (uid: string, eventId: string, participantData: any, isPaid: boolean = false) => {
        try {
            // If paid event and we are here, it means they clicked "Pay via Cash" or it was free
            // If paid, we should also update firebase with payment info
            if (isPaid) {
                await registerUserOnSpot(uid, eventId, 0);
            }

            await insertParticipant(
                uid,
                eventId,
                participantData.name,
                participantData.phone,
                participantData.email,
                participantData.college,
                participantData.college_other,
                participantData.degree,
                participantData.degree_other,
                participantData.dept,
                participantData.dept_other,
                participantData.year,
                'ONSPOT',
                0, // sync_status: 0 (unsynced) so it gets pushed to Firebase
                1   // checked_in: yes
            );

            setSubmitting(false);

            setRegisteredData({
                uid,
                name: participantData.name,
                email: participantData.email,
                phone: participantData.phone,
                college: participantData.college === 'Other' ? participantData.college_other : participantData.college,
                dept: participantData.dept === 'Other' ? participantData.dept_other : participantData.dept,
                year: participantData.year,
                events: [eventId],
                // Add payment info for QR generation if paid
                payments: isPaid ? [{
                    eventNames: [eventId],
                    verified: true,
                    amount: 0,
                    id: `onspot_${Date.now()}`
                }] : []
            });
            setShowSuccess(true);
            setShowPaymentModal(false);

        } catch (error) {
            console.error('Registration finalize error:', error);
            Alert.alert('Error', 'Failed to save registration.');
            setSubmitting(false);
        }
    };

    const handleRegister = async () => {
        if (!validateForm()) return;
        if (!eventContext?.eventName) {
            Alert.alert('Error', 'Event not set. Please re-login.');
            return;
        }

        const eventId = eventContext.eventName;
        const isPaidEvent = PAID_EVENTS.includes(eventId);

        setSubmitting(true);

        // Use pre-filled UID if available (from QR scan), otherwise generate new one
        const uid = prefilledUID || `${eventId.replace(/\s+/g, '')}-ONSPOT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const participantData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            college,
            college_other: collegeOther,
            degree,
            degree_other: degreeOther,
            dept: department,
            dept_other: departmentOther,
            year
        };

        if (isPaidEvent) {
            setPendingRegistration({ uid, eventId, participantData });
            setShowPaymentModal(true);
            // submitting stays true until modal action
            return;
        }

        // Free event - proceed directly
        await finalizeRegistration(uid, eventId, participantData, false);
    };

    if (showSuccess && registeredData) {
        const qrValue = JSON.stringify({
            uid: registeredData.uid,
            name: registeredData.name,
            email: registeredData.email,
            phone: registeredData.phone,
            college: registeredData.college,
            dept: registeredData.dept,
            year: registeredData.year,
            events: registeredData.events,
            payments: registeredData.payments // Include payments in QR
        });

        return (
            <View style={styles.successContainer}>
                <View style={[styles.eventBadge, { marginBottom: 30 }]}>
                    <Text style={styles.eventBadgeLabel}>Registration Successful</Text>
                    <Text style={styles.eventBadgeName}>{eventContext?.eventName}</Text>
                </View>

                <View style={styles.qrContainer}>
                    <QRCode
                        value={qrValue}
                        size={250}
                        color="black"
                        backgroundColor="white"
                    />
                </View>

                <Text style={styles.successTitle}>{registeredData.name}</Text>
                <Text style={styles.successSubtitle}>UID: {registeredData.uid}</Text>
                <Text style={styles.instructionText}>
                    Please ask the participant to take a photo of this QR code.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                        // Reset form
                        setName('');
                        setEmail('');
                        setPhone('');
                        setCollege('');
                        setCollegeOther('');
                        setDegree('');
                        setDegreeOther('');
                        setDepartment('');
                        setDepartmentOther('');
                        setYear('');
                        setRegisteredData(null);
                        setShowSuccess(false);
                        navigation.goBack(); // Optional: go back to scanner? Or stay for next?
                        // Actually improved flow: 'Register Another' resets, 'Done' goes back.
                        // Let's offer those two options.
                    }}
                >
                    <Text style={styles.buttonText}>Done (Go Back)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#333', marginTop: 16 }]}
                    onPress={() => {
                        // Reset form and stay
                        setName('');
                        setEmail('');
                        setPhone('');
                        setCollege('');
                        setCollegeOther('');
                        setDegree('');
                        setDegreeOther('');
                        setDepartment('');
                        setDepartmentOther('');
                        setYear('');
                        setRegisteredData(null);
                        setShowSuccess(false);
                    }}
                >
                    <Text style={[styles.buttonText, { color: '#FFF' }]}>Register Another</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
            >
                {/* Event Badge */}
                <View style={styles.eventBadge}>
                    <Text style={styles.eventBadgeLabel}>Registering for</Text>
                    <Text style={styles.eventBadgeName}>{eventContext?.eventName || 'No Event'}</Text>
                </View>

                <Text style={styles.title}>New Registration</Text>
                <Text style={styles.subtitle}>Fill in the participant details</Text>

                {/* Personal Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter full name"
                            placeholderTextColor="#666"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Email Address *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter email"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Phone Number *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 10-digit phone number"
                            placeholderTextColor="#666"
                            value={phone}
                            onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>
                </View>

                {/* Academic Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Academic Information</Text>

                    <Dropdown
                        label="College *"
                        value={college}
                        options={COLLEGES}
                        onSelect={setCollege}
                        placeholder="Select your college"
                    />

                    {college === 'Other' && (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>College Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your college name"
                                placeholderTextColor="#666"
                                value={collegeOther}
                                onChangeText={setCollegeOther}
                            />
                        </View>
                    )}

                    <Dropdown
                        label="Degree *"
                        value={degree}
                        options={DEGREES}
                        onSelect={setDegree}
                        placeholder="Select your degree"
                    />

                    {degree === 'Other' && (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Degree Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your degree"
                                placeholderTextColor="#666"
                                value={degreeOther}
                                onChangeText={setDegreeOther}
                            />
                        </View>
                    )}

                    <Dropdown
                        label="Department *"
                        value={department}
                        options={DEPARTMENTS}
                        onSelect={setDepartment}
                        placeholder="Select your department"
                    />

                    {department === 'Other' && (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Department Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your department"
                                placeholderTextColor="#666"
                                value={departmentOther}
                                onChangeText={setDepartmentOther}
                            />
                        </View>
                    )}

                    <Dropdown
                        label="Year of Study *"
                        value={year}
                        options={YEARS}
                        onSelect={setYear}
                        placeholder="Select year"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, submitting && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={submitting}
                >
                    <Text style={styles.buttonText}>
                        {submitting ? 'Registering...' : 'Submit Registration'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Payment Modal */}
            <Modal
                visible={showPaymentModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setShowPaymentModal(false);
                    setSubmitting(false);
                }}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>💰 Payment Required</Text>
                        <Text style={styles.modalSubtitle}>Event: {eventContext?.eventName}</Text>

                        <View style={styles.qrViewContainer}>
                            <Image
                                source={require('../tresurerQR.jpg')}
                                style={styles.qrImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.modalInstruction}>
                            Scan to Pay. Treasurer Verification Required.
                        </Text>

                        <TouchableOpacity
                            style={styles.payCashButton}
                            onPress={() => {
                                if (pendingRegistration) {
                                    finalizeRegistration(
                                        pendingRegistration.uid,
                                        pendingRegistration.eventId,
                                        pendingRegistration.participantData,
                                        true
                                    );
                                }
                            }}
                        >
                            <Text style={styles.payCashButtonText}>💵 Verified - Register User</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setShowPaymentModal(false);
                                setSubmitting(false);
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    eventBadge: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    eventBadgeLabel: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    eventBadgeName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFD700',
        marginTop: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 30,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#FFD700',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 15,
        fontSize: 16,
        backgroundColor: '#111',
        color: 'white',
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 15,
        backgroundColor: '#111',
    },
    dropdownText: {
        fontSize: 16,
        color: 'white',
        flex: 1,
    },
    placeholder: {
        color: '#666',
    },
    dropdownArrow: {
        color: '#FFD700',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#111',
        borderRadius: 16,
        width: '100%',
        maxHeight: '70%',
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFD700',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    modalItemSelected: {
        backgroundColor: '#1a1a1a',
    },
    modalItemText: {
        fontSize: 16,
        color: '#FFF',
    },
    modalItemTextSelected: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#FFD700',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        padding: 10,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#000',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: 30,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 10,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 16,
        color: '#FFF',
        marginBottom: 10,
        textAlign: 'center',
    },
    instructionText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 30,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    // modalContent: {
    //     backgroundColor: '#1E1E1E',
    //     borderRadius: 20,
    //     padding: 24,
    //     alignItems: 'center',
    //     width: '100%',
    //     maxWidth: 340,
    //     borderWidth: 1,
    //     borderColor: '#333'
    // },
    // modalTitle: {
    //     color: '#FFD700',
    //     fontSize: 24,
    //     fontWeight: 'bold',
    //     marginBottom: 8
    // },
    modalSubtitle: {
        color: '#AAA',
        fontSize: 16,
        marginBottom: 20
    },
    qrViewContainer: {
        width: 200,
        height: 200,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 5,
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    qrImage: {
        width: '100%',
        height: '100%'
    },
    modalInstruction: {
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 24,
        fontSize: 14
    },
    payCashButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12
    },
    payCashButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    cancelButton: {
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center'
    },
    cancelButtonText: {
        color: '#FF5252',
        fontSize: 16
    }
});

export default RegistrationScreen;
