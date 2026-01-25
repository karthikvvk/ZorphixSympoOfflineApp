import React, { useState } from 'react';
import { Text, View, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, PAID_EVENTS } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { getParticipantByUID, getParticipantByUIDAndEvent, markParticipated, insertParticipant, checkParticipantExists } from '../services/sqlite';
import { checkPaymentStatus, getParticipantFromFirebase, registerUserOnSpot } from '../services/firebase';
import { Modal, Image } from 'react-native';
import { RouteProp } from '@react-navigation/native';

type QRScannerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'QRScanner'>;
type QRScannerScreenRouteProp = RouteProp<RootStackParamList, 'QRScanner'>;

type Props = {
    navigation: QRScannerScreenNavigationProp;
    route: QRScannerScreenRouteProp;
};

export default function QRScannerScreen({ navigation, route }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Team Scanning State
    const mode = route.params?.mode || 'INDIVIDUAL';
    const totalTeamSize = route.params?.teamSize || 1;
    const [scannedCount, setScannedCount] = useState(0);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingParticipant, setPendingParticipant] = useState<any>(null);

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [toastOpacity] = useState(new Animated.Value(0));

    const { eventContext } = useEventContext();

    const currentEvent = eventContext?.eventName || '';
    const isPaidEvent = PAID_EVENTS.includes(currentEvent);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);

        Animated.sequence([
            Animated.timing(toastOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2500),
            Animated.timing(toastOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setToastVisible(false);
        });
    };

    const resetScanState = () => {
        setScanned(false);
        setProcessing(false);
    };

    const finalizeEntry = (participant: any) => {
        markParticipated(participant.uid, currentEvent);
        console.log(`✅ Marked ${participant.name} as participated`);

        if (mode === 'TEAM') {
            const newCount = scannedCount + 1;
            const newMembers = [...teamMembers, participant];
            setTeamMembers(newMembers);
            setScannedCount(newCount);

            if (newCount >= totalTeamSize) {
                showToast(`🎉 All ${totalTeamSize} members verified!`, 'success');
                setTimeout(() => navigation.goBack(), 3000);
            } else {
                showToast(`✅ ${participant.name} verified (${newCount}/${totalTeamSize})`, 'success');
                resetScanState();
            }
        } else {
            showToast(`✅ ${participant.name} enrolled successfully!`, 'success');
            resetScanState();
        }
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || processing) return;

        setScanned(true);
        setProcessing(true);

        try {
            const scannedData = data.trim();
            console.log('SCAN:', scannedData);

            let uid = scannedData;
            let prefilledData: any = {};

            // Try to parse JSON
            try {
                const json = JSON.parse(scannedData);
                console.log('Parsed QR JSON:', json);
                if (json.uid) {
                    uid = json.uid;
                    prefilledData = {
                        prefilledUID: json.uid,
                        prefilledName: json.name || '',
                        prefilledEmail: json.email || '',
                        prefilledPhone: json.phone || '',
                        prefilledCollege: json.college || '',
                        prefilledDept: json.dept || json.department || '',
                        prefilledYear: json.year || ''
                    };
                }
            } catch (e) {
                // Not JSON, assume raw UID
                console.log('Not JSON, treating as raw UID');
            }

            // Check for duplicates in current team session
            if (mode === 'TEAM' && teamMembers.some(m => m.uid === uid)) {
                Alert.alert(
                    "⚠️ Duplicate Scan",
                    "This member has already been scanned for this team.",
                    [{ text: "OK", onPress: resetScanState }]
                );
                return;
            }

            // Check if user exists in LOCAL DB for THIS event
            let participant = await getParticipantByUIDAndEvent(uid, currentEvent);

            // === USER EXISTS ===
            if (participant) {
                console.log(`✅ User ${participant.name} found in DB.`);

                // === ALREADY ATTENDED ===
                if (participant.participated === 1) {
                    if (isPaidEvent) {
                        // Paid event + already attended = NO re-entry
                        Alert.alert(
                            "⚠️ Already Attended",
                            `${participant.name} has already participated in ${currentEvent}.`,
                            [{ text: "OK", onPress: resetScanState }]
                        );
                        return;
                    } else {
                        // Non-paid event + already attended = Allow re-entry option
                        Alert.alert(
                            "⚠️ Already Attended",
                            `${participant.name} has already attended.\n\nAllow entry again?`,
                            [
                                { text: "Cancel", style: "cancel", onPress: resetScanState },
                                {
                                    text: "OK",
                                    onPress: () => {
                                        finalizeEntry(participant);
                                    }
                                }
                            ]
                        );
                        return;
                    }
                }

                // === NOT ATTENDED YET ===
                if (isPaidEvent) {
                    // Check payment status
                    try {
                        const pStatus = await checkPaymentStatus(uid, currentEvent);
                        if (!pStatus.verified && participant.payment_verified !== 1) {
                            // Payment not done - show treasurer QR
                            setPendingParticipant(participant);
                            setShowPaymentModal(true);
                            return;
                        }
                    } catch (e) {
                        // Offline fallback - check local DB
                        if (participant.payment_verified !== 1) {
                            setPendingParticipant(participant);
                            setShowPaymentModal(true);
                            return;
                        }
                    }
                }

                // Payment verified or non-paid event - enroll user
                finalizeEntry(participant);
                return;
            }

            // === USER NOT FOUND ===
            console.log('❌ User not found locally');

            // Only redirect to registration if QR doesn't have email/phone
            if (!prefilledData.prefilledEmail && !prefilledData.prefilledPhone) {
                console.log('⚠️ QR missing email/phone - redirecting to registration');
                setProcessing(false);
                navigation.navigate('Registration', {
                    ...prefilledData,
                    autoEnroll: true,
                    eventName: currentEvent
                });
                return;
            }

            // QR has email/phone but user not in DB
            if (isPaidEvent) {
                // PAID EVENT - Be suspicious, could be tampering
                Alert.alert(
                    "⚠️ Verification Failed",
                    "Participant details found in QR but not registered for this PAID event.\n\nThis could be:\n• Tampered QR code\n• Wrong event QR\n• Registration sync issue\n\nPlease verify with admin.",
                    [
                        { text: "Cancel", style: "cancel", onPress: resetScanState },
                        {
                            text: "Register Anyway",
                            onPress: () => {
                                setProcessing(false);
                                navigation.navigate('Registration', {
                                    ...prefilledData,
                                    autoEnroll: true,
                                    eventName: currentEvent
                                });
                            }
                        }
                    ]
                );
            } else {
                // NON-PAID EVENT - Accept silently, register them automatically
                console.log('📝 Auto-registering for non-paid event');
                try {
                    await insertParticipant(
                        uid,
                        currentEvent,
                        prefilledData.prefilledName || 'Participant',
                        prefilledData.prefilledPhone || '',
                        prefilledData.prefilledEmail || '',
                        prefilledData.prefilledCollege || '',
                        '',
                        '', // degree
                        '',
                        prefilledData.prefilledDept || '',
                        '',
                        prefilledData.prefilledYear || '',
                        'QR_AUTO',
                        0, // payment_verified - not applicable for non-paid
                        0  // participated - will be marked next
                    );

                    // Fetch the newly inserted participant
                    const newParticipant = await getParticipantByUIDAndEvent(uid, currentEvent);
                    if (newParticipant) {
                        finalizeEntry(newParticipant);
                    }
                } catch (error) {
                    console.error('Auto-registration error:', error);
                    Alert.alert(
                        "Error",
                        "Failed to auto-register participant.",
                        [{ text: "OK", onPress: resetScanState }]
                    );
                }
            }

        } catch (error) {
            console.error("Scan error:", error);
            Alert.alert(
                "Error",
                "Failed to process QR code",
                [{ text: "OK", onPress: resetScanState }]
            );
        } finally {
            if (!showPaymentModal) {
                setProcessing(false);
            }
        }
    };

    const handlePaymentVerified = async () => {
        if (!pendingParticipant) return;

        setProcessing(true);
        try {
            const { uid, name, email, phone, college, degree, department, year } = pendingParticipant;
            console.log(`💸 Processing payment verification for ${uid}`);

            // Update Firebase
            const success = await registerUserOnSpot(uid, currentEvent, 0);

            if (success) {
                // Update local DB - mark payment as verified
                await insertParticipant(
                    uid,
                    currentEvent,
                    name,
                    phone,
                    email,
                    college || '',
                    '',
                    degree || '',
                    '',
                    department || '',
                    '',
                    year || '',
                    'ONSPOT',
                    1, // payment_verified
                    0  // NOT participated yet
                );

                console.log(`✅ Payment verified for ${name}`);

                // Close modal
                setShowPaymentModal(false);

                // Fetch the updated participant and finalize
                const updatedParticipant = await getParticipantByUIDAndEvent(uid, currentEvent);
                if (updatedParticipant) {
                    finalizeEntry(updatedParticipant);
                }

                setPendingParticipant(null);
            } else {
                Alert.alert("❌ Error", "Failed to verify payment. Please check internet connection.");
            }
        } catch (error) {
            console.error("Payment verification error:", error);
            Alert.alert("❌ Error", "An error occurred during payment verification.");
        } finally {
            setProcessing(false);
        }
    };

    const handleCancelPayment = () => {
        setShowPaymentModal(false);
        setPendingParticipant(null);
        resetScanState();
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionIcon}>📷</Text>
                    <Text style={styles.text}>Camera Permission Required</Text>
                    <Text style={styles.subText}>We need camera access to scan QR codes</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Event Badge */}
            <View style={styles.eventBadge}>
                <Text style={styles.eventBadgeLabel}>
                    {mode === 'TEAM' ? `Team Verification (${scannedCount + 1}/${totalTeamSize})` : 'Verifying for'}
                </Text>
                <Text style={styles.eventBadgeName}>{currentEvent}</Text>
                {isPaidEvent && <Text style={styles.paidBadge}>💳 PAID EVENT</Text>}
            </View>

            {/* Camera View */}
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />

                {/* Scan Frame Overlay */}
                <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                </View>

                {processing && !showPaymentModal && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#FFD700" />
                        <Text style={styles.processingText}>Verifying...</Text>
                    </View>
                )}
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                    {scanned ? 'Processing...' : 'Point camera at participant\'s QR code'}
                </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            {/* Toast Notification */}
            {toastVisible && (
                <Animated.View
                    style={[
                        styles.toast,
                        toastType === 'success' ? styles.toastSuccess : styles.toastError,
                        { opacity: toastOpacity }
                    ]}
                >
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}

            {/* Payment Modal */}
            <Modal
                visible={showPaymentModal}
                transparent={true}
                animationType="slide"
                onRequestClose={handleCancelPayment}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>💰 Payment Required</Text>
                        <Text style={styles.modalSubtitle}>Event: {currentEvent}</Text>
                        {pendingParticipant && (
                            <Text style={styles.participantName}>{pendingParticipant.name}</Text>
                        )}

                        <View style={styles.qrContainer}>
                            <Image
                                source={require('../tresurerQR.jpg')}
                                style={styles.qrImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.modalInstruction}>
                            Ask participant to scan and pay.{'\n'}Verify payment with Treasurer before confirming.
                        </Text>

                        <TouchableOpacity
                            style={styles.payCashButton}
                            onPress={handlePaymentVerified}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.payCashButtonText}>✅ Payment Verified - Enroll User</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleCancelPayment}
                            disabled={processing}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    eventBadge: {
        backgroundColor: '#111',
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    eventBadgeLabel: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    eventBadgeName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
        marginTop: 4,
    },
    paidBadge: {
        fontSize: 12,
        color: '#4CAF50',
        marginTop: 8,
        fontWeight: 'bold',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    scanFrame: {
        position: 'absolute',
        top: '25%',
        left: '15%',
        width: '70%',
        height: '50%',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#FFD700',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 3,
        borderLeftWidth: 3,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 3,
        borderRightWidth: 3,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: '#FFD700',
        fontSize: 18,
        marginTop: 16,
    },
    instructions: {
        padding: 20,
        alignItems: 'center',
    },
    instructionText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    text: {
        color: '#FFD700',
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subText: {
        color: '#888',
        textAlign: 'center',
        fontSize: 14,
        marginBottom: 30,
    },
    permissionButton: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 18,
    },
    toast: {
        position: 'absolute',
        top: 120,
        left: 20,
        right: 20,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    toastSuccess: {
        backgroundColor: '#4CAF50',
    },
    toastError: {
        backgroundColor: '#F44336',
    },
    toastText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: '#333'
    },
    modalTitle: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8
    },
    modalSubtitle: {
        color: '#AAA',
        fontSize: 16,
        marginBottom: 8
    },
    participantName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20
    },
    qrContainer: {
        width: 200,
        height: 200,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 10,
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
        fontSize: 14,
        lineHeight: 20
    },
    payCashButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        minHeight: 48
    },
    payCashButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    cancelButton: {
        marginTop: 12,
        padding: 12
    },
    cancelButtonText: {
        color: '#AAA',
        fontSize: 16
    }
});