import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Animated, Modal, Image, BackHandler } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, PAID_EVENTS } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { getParticipantByUID, getParticipantByUIDAndEvent, incrementParticipation, insertParticipant, checkParticipantExists, getParticipantByEmailOrPhone, getParticipantTeams } from '../services/sqlite';
import { checkPaymentStatus, getParticipantFromFirebase, registerUserOnSpot } from '../services/firebase';
import { silentBackup, requestStoragePermission } from '../services/BackupService';
// import { Modal, Image } from 'react-native'; // Removed redundant import
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
    const teamNameParam = route.params?.teamName || '';
    const [scannedCount, setScannedCount] = useState(0);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingParticipant, setPendingParticipant] = useState<any>(null);
    const [isEnrollButtonDisabled, setIsEnrollButtonDisabled] = useState(false);

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState<{ name: string; message: string; subMessage?: string }>({ name: '', message: '' });

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [toastOpacity] = useState(new Animated.Value(0));

    const { eventContext } = useEventContext();

    const currentEvent = eventContext?.eventName || '';
    const isPaidEvent = PAID_EVENTS.includes(currentEvent);

    useEffect(() => {
        if (showPaymentModal) {
            setIsEnrollButtonDisabled(true);
            const timer = setTimeout(() => {
                setIsEnrollButtonDisabled(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showPaymentModal]);

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

    const finalizeEntry = async (participant: any) => {
        // Check if user is already in other teams (for team mode)
        if (mode === 'TEAM' && teamNameParam) {
            const existingTeams = await getParticipantTeams(participant.uid, currentEvent);

            if (existingTeams.length > 0 && !existingTeams.includes(teamNameParam)) {
                // User is already in team(s), show warning but allow adding
                Alert.alert(
                    "⚠️ Already in Team",
                    `${participant.name} is already in team(s): ${existingTeams.join(', ')}\n\nAdd to "${teamNameParam}" as well?`,
                    [
                        {
                            text: "Cancel",
                            style: "cancel",
                            onPress: resetScanState
                        },
                        {
                            text: "Add Anyway",
                            onPress: () => {
                                proceedWithEntry(participant);
                            }
                        }
                    ]
                );
                return;
            }
        }

        proceedWithEntry(participant);
    };

    const proceedWithEntry = (participant: any) => {
        incrementParticipation(participant.uid, currentEvent, teamNameParam);
        // Trigger silent backup after each enrollment
        silentBackup();

        if (mode === 'TEAM') {
            const newCount = scannedCount + 1;
            const newMembers = [...teamMembers, participant];
            setTeamMembers(newMembers);
            setScannedCount(newCount);

            if (newCount >= totalTeamSize) {
                setSuccessData({
                    name: 'Team Complete!',
                    message: `All ${totalTeamSize} members verified.`,
                    subMessage: 'Redirecting...'
                });
                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    navigation.goBack();
                }, 2500);
            } else {
                setSuccessData({
                    name: participant.name,
                    message: 'Verified Successfully',
                    subMessage: `Team Progress: ${newCount}/${totalTeamSize}`
                });
                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    resetScanState();
                }, 2000);
            }
        } else {
            setSuccessData({
                name: participant.name,
                message: 'Enrolled Successfully'
            });
            setShowSuccessModal(true);
            setTimeout(() => {
                setShowSuccessModal(false);
                resetScanState();
            }, 700);
        }
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || processing) return;

        setScanned(true);
        setProcessing(true);

        //console.log('='.repeat(60));
        //console.log('🔍 QR SCAN STARTED');
        //console.log('='.repeat(60));
        //console.log('📋 Current Event:', currentEvent);
        //console.log('💰 Is Paid Event:', isPaidEvent);
        //console.log('👥 Mode:', mode);

        try {
            const scannedData = data.trim();
            //console.log('📱 Raw Scanned Data:', scannedData);

            let uid = scannedData;
            let prefilledData: any = {};

            // Try to parse JSON
            try {
                const json = JSON.parse(scannedData);
                //console.log('✅ Parsed as JSON:', JSON.stringify(json, null, 2));
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
                    //console.log('📊 Prefilled Data from QR:', JSON.stringify(prefilledData, null, 2));
                }
            } catch (e) {
                //console.log('⚠️ Not JSON, treating as raw UID');
            }

            //console.log('🔑 Final UID:', uid);

            // Check for duplicates in current team session
            if (mode === 'TEAM' && teamMembers.some(m => m.uid === uid)) {
                //console.log('❌ DUPLICATE SCAN - Already in team session');
                Alert.alert(
                    "⚠️ Duplicate Scan",
                    "This member has already been scanned for this team.",
                    [{ text: "OK", onPress: resetScanState }]
                );
                return;
            }

            // Check if user exists in LOCAL DB for THIS event
            // Pass email/phone to also search by those (handles Excel import UIDs vs Firebase Auth UIDs)
            //console.log('-'.repeat(40));
            //console.log('🗄️ STEP 1: Checking LOCAL DB for user...');
            //console.log('   Searching by UID:', uid);
            //console.log('   Also searching by email:', prefilledData.prefilledEmail || '(none)');
            //console.log('   Also searching by phone:', prefilledData.prefilledPhone || '(none)');
            let participant = await getParticipantByUIDAndEvent(
                uid,
                currentEvent,
                prefilledData.prefilledEmail,
                prefilledData.prefilledPhone
            );

            // === USER EXISTS IN LOCAL DB ===
            if (participant) {
                //console.log('✅ USER FOUND IN LOCAL DB!');
                //console.log('   Name:', participant.name);
                //console.log('   UID:', participant.uid);
                //console.log('   Event:', participant.event_name);
                //console.log('   Participated Count:', participant.participated);
                //console.log('   Payment Verified (local):', participant.payment_verified);
                //console.log('-'.repeat(40));

                // === ALREADY ATTENDED CHECK ===
                if (participant.participated > 1) {
                    //console.log('⚠️ USER HAS ALREADY ATTENDED!');
                    //console.log('   Times attended:', participant.participated);
                    //console.log('   Is Paid Event:', isPaidEvent);

                    if (isPaidEvent) {
                        //console.log('🚫 DECISION: BLOCK - Paid event, no re-entry allowed');
                        Alert.alert(
                            "🚫 Unauthorized Entry Blocked",
                            `${participant.name} has already entered ${participant.participated} time(s).\n\nEvent: ${currentEvent}\n\nPaid events allow only ONE entry per ticket.`,
                            [{ text: "OK", onPress: resetScanState }]
                        );
                        return;
                    } else {
                        //console.log('⚠️ DECISION: WARN - Non-paid event, allow re-entry with warning');
                        Alert.alert(
                            "⚠️ Re-attendance Detected",
                            `${participant.name} has already attended ${participant.participated} time(s).\n\nEvent: ${currentEvent}\n\nAllow re-entry?`,
                            [
                                { text: "Cancel", style: "cancel", onPress: resetScanState },
                                {
                                    text: "Enroll Anyway",
                                    onPress: () => {
                                        //console.log('✅ User chose to enroll anyway');
                                        finalizeEntry(participant);
                                    }
                                }
                            ]
                        );
                        return;
                    }
                }

                // === NOT ATTENDED YET ===
                //console.log('✅ User has NOT attended yet (participated = 0)');

                // SIMPLIFIED LOGIC: If user EXISTS in local DB for this event = THEY PAID
                // (They were either synced from Firebase after payment, or registered on-spot with payment)
                if (isPaidEvent) {
                    //console.log('💰 PAID EVENT - User is in local DB = ALREADY PAID');
                    //console.log('   ✅ No payment check needed - existence in DB = paid');
                } else {
                    //console.log('🆓 NON-PAID EVENT - No payment check needed');
                }

                //console.log('✅ DECISION: ALLOW ENTRY - Finalizing...');
                finalizeEntry(participant);
                return;
            }

            // === USER NOT FOUND IN LOCAL DB ===
            //console.log('❌ USER NOT FOUND IN LOCAL DB');
            //console.log('-'.repeat(40));
            //console.log('🗄️ STEP 2: User not in local DB for this event');
            //console.log('📊 Prefilled data from QR:', JSON.stringify(prefilledData, null, 2));

            // === TRY TO FETCH PAYMENT STATUS FROM FIREBASE ===
            //console.log('-'.repeat(40));
            //console.log('🔥 STEP 3: Checking Firebase for payment status...');
            let hasPaidInFirebase = false;

            try {
                const pStatus = await checkPaymentStatus(uid, currentEvent);
                //console.log('🔥 Firebase payment response:', JSON.stringify(pStatus, null, 2));
                if (pStatus) {
                    hasPaidInFirebase = pStatus.verified === true;
                    //console.log('   hasPaidInFirebase:', hasPaidInFirebase);
                }
            } catch (e) {
                //console.log('⚠️ Firebase payment check failed:', e);
                //console.log('   Continuing with hasPaidInFirebase = false');
            }

            //console.log('-'.repeat(40));
            //console.log('📝 STEP 4: Processing new user entry...');
            //console.log('   hasPaidInFirebase:', hasPaidInFirebase);
            //console.log('   isPaidEvent:', isPaidEvent);

            await processNewUserEntry(uid, prefilledData, hasPaidInFirebase);

            async function processNewUserEntry(uid: string, prefilledData: any, alreadyPaid: boolean) {
                //console.log('-'.repeat(40));
                //console.log('📝 processNewUserEntry() called');
                //console.log('   UID:', uid);
                //console.log('   alreadyPaid:', alreadyPaid);

                // Merge data from local DB and Firebase
                let mergedData = { ...prefilledData };

                // 1. First try local DB lookup by email/phone (any event)
                //console.log('🔍 Checking local DB by email/phone for other events...');
                if (prefilledData.prefilledEmail || prefilledData.prefilledPhone) {
                    const localParticipant = await getParticipantByEmailOrPhone(
                        prefilledData.prefilledEmail || '',
                        prefilledData.prefilledPhone || ''
                    );

                    if (localParticipant) {
                        //console.log('✅ Found user in local DB (other event):', localParticipant.name);
                        mergedData.prefilledName = mergedData.prefilledName || localParticipant.name || '';
                        mergedData.prefilledEmail = mergedData.prefilledEmail || localParticipant.email || '';
                        mergedData.prefilledPhone = mergedData.prefilledPhone || localParticipant.phone || '';
                        mergedData.prefilledCollege = mergedData.prefilledCollege || localParticipant.college || '';
                        mergedData.prefilledDegree = mergedData.prefilledDegree || localParticipant.degree || '';
                        mergedData.prefilledDept = mergedData.prefilledDept || localParticipant.department || '';
                        mergedData.prefilledYear = mergedData.prefilledYear || localParticipant.year || '';
                    } else {
                        //console.log('❌ No match in local DB by email/phone');
                    }
                } else {
                    //console.log('⚠️ No email/phone in QR to lookup');
                }

                // 2. Try Firebase lookup by UID if still missing critical data
                //console.log('🔍 Checking if Firebase lookup needed for user data...');
                //console.log('   Has name:', !!mergedData.prefilledName);
                //console.log('   Has college:', !!mergedData.prefilledCollege);

                if (!mergedData.prefilledName || !mergedData.prefilledCollege) {
                    //console.log('🔥 Fetching user data from Firebase...');
                    try {
                        const firebaseData = await getParticipantFromFirebase(uid);
                        if (firebaseData) {
                            //console.log('✅ Found user data in Firebase:', JSON.stringify(firebaseData, null, 2));
                            mergedData.prefilledName = mergedData.prefilledName || firebaseData.name || firebaseData.fullName || '';
                            mergedData.prefilledEmail = mergedData.prefilledEmail || firebaseData.email || '';
                            mergedData.prefilledPhone = mergedData.prefilledPhone || firebaseData.phone || firebaseData.phoneNumber || '';
                            mergedData.prefilledCollege = mergedData.prefilledCollege || firebaseData.college || '';
                            mergedData.prefilledDegree = mergedData.prefilledDegree || firebaseData.degree || '';
                            mergedData.prefilledDept = mergedData.prefilledDept || firebaseData.department || firebaseData.dept || '';
                            mergedData.prefilledYear = mergedData.prefilledYear || firebaseData.year || '';
                        } else {
                            //console.log('❌ No user data in Firebase for UID:', uid);
                        }
                    } catch (e) {
                        //console.log('❌ Firebase user lookup failed:', e);
                    }
                } else {
                    //console.log('✅ Already have name and college, skipping Firebase lookup');
                }

                // === CRITICAL DATA CHECK ===
                //console.log('-'.repeat(40));
                //console.log('📊 CRITICAL DATA CHECK:');
                //console.log('   Name:', mergedData.prefilledName || '(MISSING)');
                //console.log('   Email:', mergedData.prefilledEmail || '(none)');
                //console.log('   Phone:', mergedData.prefilledPhone || '(none)');
                //console.log('   College:', mergedData.prefilledCollege || '(MISSING)');

                const hasCriticalData =
                    mergedData.prefilledName &&
                    (mergedData.prefilledEmail || mergedData.prefilledPhone) &&
                    mergedData.prefilledCollege;

                //console.log('   Has critical data:', hasCriticalData);

                // Only redirect to registration if CRITICAL data is missing
                if (!hasCriticalData) {
                    //console.log('🚨 MISSING CRITICAL DATA - Redirecting to Registration');
                    setProcessing(false);
                    navigation.navigate('Registration', {
                        ...mergedData,
                        autoEnroll: true,
                        eventName: currentEvent
                    });
                    return;
                }

                //console.log('✅ All critical data present');
                //console.log('-'.repeat(40));
                //console.log('🎯 FINAL DECISION:');
                //console.log('   isPaidEvent:', isPaidEvent);
                //console.log('   alreadyPaid:', alreadyPaid);

                // === HAS ALL CRITICAL DATA - PROCEED ===
                if (isPaidEvent) {
                    if (alreadyPaid) {
                        //console.log('✅ PAID EVENT + ALREADY PAID = Allow entry directly');
                        try {
                            //console.log('📝 Inserting participant into local DB...');
                            await insertParticipant(
                                uid,
                                currentEvent,
                                mergedData.prefilledName || 'Participant',
                                mergedData.prefilledPhone || '',
                                mergedData.prefilledEmail || '',
                                mergedData.prefilledCollege || '',
                                mergedData.prefilledDegree || '',
                                mergedData.prefilledDept || '',
                                mergedData.prefilledYear || '',
                                'QR_AUTO',
                                0,
                                1, // payment_verified = 1
                                0,
                                teamNameParam,
                                '',
                                'paid'
                            );
                            //console.log('✅ Participant inserted successfully');
                            const newParticipant = await getParticipantByUIDAndEvent(uid, currentEvent);
                            if (newParticipant) {
                                //console.log('✅ Finalizing entry for:', newParticipant.name);
                                finalizeEntry(newParticipant);
                            }
                        } catch (error) {
                            console.error('❌ Auto-registration error:', error);
                            Alert.alert("Error", "Failed to register participant.", [{ text: "OK", onPress: resetScanState }]);
                        }
                    } else {
                        //console.log('💳 PAID EVENT + NOT PAID = Show Treasurer QR');
                        const pendingParticipantData = {
                            uid: uid,
                            name: mergedData.prefilledName,
                            email: mergedData.prefilledEmail || '',
                            phone: mergedData.prefilledPhone || '',
                            college: mergedData.prefilledCollege || '',
                            degree: mergedData.prefilledDegree || '',
                            department: mergedData.prefilledDept || '',
                            year: mergedData.prefilledYear || ''
                        };
                        //console.log('📋 Pending participant:', JSON.stringify(pendingParticipantData, null, 2));
                        setPendingParticipant(pendingParticipantData);
                        setShowPaymentModal(true);
                    }
                } else {
                    //console.log('🆓 NON-PAID EVENT = Auto-register and allow');
                    try {
                        //console.log('📝 Inserting participant into local DB...');
                        await insertParticipant(
                            uid,
                            currentEvent,
                            mergedData.prefilledName || 'Participant',
                            mergedData.prefilledPhone || '',
                            mergedData.prefilledEmail || '',
                            mergedData.prefilledCollege || '',
                            mergedData.prefilledDegree || '',
                            mergedData.prefilledDept || '',
                            mergedData.prefilledYear || '',
                            'QR_AUTO',
                            0,
                            0,
                            0,
                            teamNameParam,
                            '',
                            'free'
                        );
                        //console.log('✅ Participant inserted successfully');
                        const newParticipant = await getParticipantByUIDAndEvent(uid, currentEvent);
                        if (newParticipant) {
                            //console.log('✅ Finalizing entry for:', newParticipant.name);
                            finalizeEntry(newParticipant);
                        }
                    } catch (error) {
                        console.error('❌ Auto-registration error:', error);
                        Alert.alert("Error", "Failed to auto-register participant.", [{ text: "OK", onPress: resetScanState }]);
                    }
                }
            }

        } catch (error) {
            console.error("❌ SCAN ERROR:", error);
            Alert.alert(
                "Error",
                "Failed to process QR code",
                [{ text: "OK", onPress: resetScanState }]
            );
        } finally {
            //console.log('='.repeat(60));
            //console.log('🔍 QR SCAN COMPLETED');
            //console.log('='.repeat(60));
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
            ////console.log('💸 ===== PAYMENT VERIFICATION START =====');
            ////console.log('   UID:', uid);
            ////console.log('   Name:', name);
            ////console.log('   Email:', email);
            ////console.log('   Phone:', phone);
            ////console.log('   Event:', currentEvent);

            // === STEP 1: ALWAYS UPDATE LOCAL DB FIRST (This always works) ===
            ////console.log('� Step 1: Updating local DB...');
            await insertParticipant(
                uid,
                currentEvent,
                name,
                phone,
                email,
                college || '',
                degree || '',
                department || '',
                year || '',
                'ONSPOT',
                0, // sync_status = 0 (not synced yet, will sync later)
                1, // payment_verified = 1 (payment confirmed)
                0, // participated
                '', // team_name
                '', // team_members
                'paid'
            );
            ////console.log('✅ Local DB updated successfully');

            // === STEP 2: Close modal and finalize ===
            setShowPaymentModal(false);

            // Fetch the updated participant and finalize
            const updatedParticipant = await getParticipantByUIDAndEvent(uid, currentEvent);
            if (updatedParticipant) {
                finalizeEntry(updatedParticipant);
            }

            setPendingParticipant(null);
            ////console.log('✅ Payment verification COMPLETE');

        } catch (error) {
            console.error("❌ Payment verification error:", error);
            Alert.alert("❌ Error", "Failed to save to local database.");
        } finally {
            setProcessing(false);
            ////console.log('💸 ===== PAYMENT VERIFICATION END =====');
        }
    };

    const handleCancelPayment = () => {
        setShowPaymentModal(false);
        setPendingParticipant(null);
        resetScanState();
    };

    // Strict Permission Enforcement Effect
    useEffect(() => {
        const checkPermissions = async () => {
            // 1. Check Camera Permission
            if (permission && !permission.granted && permission.canAskAgain) {
                const result = await requestPermission();
                if (!result.granted) {
                    //console.log('❌ Camera permission denied. Exiting app.');
                    BackHandler.exitApp();
                    return;
                }
            } else if (permission && !permission.granted && !permission.canAskAgain) {
                // Denied permanently
                //console.log('❌ Camera permission permanently denied. Exiting app.');
                BackHandler.exitApp();
                return;
            }

            // 2. Check Storage Permission (Android Only)
            const storageGranted = await requestStoragePermission();
            if (!storageGranted) {
                //console.log('❌ Storage permission denied. Exiting app.');
                BackHandler.exitApp();
                return;
            }
        };

        checkPermissions();
    }, [permission]); // run when camera permission object updates

    // Loading state while waiting for permission object
    if (!permission) {
        return <View style={styles.container} />;
    }

    // If still not granted (should have exited, but as a fallback/interim render)
    if (!permission.granted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={{ color: '#fff', marginTop: 20 }}>Checking Permissions...</Text>
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
                <MaterialCommunityIcons name="close" size={24} color="#FFD700" />
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
                            style={[
                                styles.payCashButton,
                                (processing || isEnrollButtonDisabled) && { opacity: 0.6 },
                                isEnrollButtonDisabled && { backgroundColor: '#666' }
                            ]}
                            onPress={handlePaymentVerified}
                            disabled={processing || isEnrollButtonDisabled}
                        >
                            {processing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.payCashButtonText}>Payment Verified - Enroll User</Text>
                                </View>
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

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { }} // Cannot close manually, waits for timeout
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, styles.successModalContent]}>
                        <MaterialCommunityIcons name="check-decagram" size={80} color="#4CAF50" style={{ marginBottom: 20 }} />

                        <Text style={styles.successName}>{successData.name}</Text>
                        <Text style={styles.successMessage}>{successData.message}</Text>

                        {successData.subMessage && (
                            <Text style={styles.successSubMessage}>{successData.subMessage}</Text>
                        )}
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
    // permissionIcon style removed
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
    // closeText removed
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
    },
    successModalContent: {
        borderWidth: 2,
        borderColor: '#4CAF50',
        paddingVertical: 40
    },
    successName: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8
    },
    successMessage: {
        color: '#4CAF50',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8
    },
    successSubMessage: {
        color: '#AAA',
        fontSize: 14,
        textAlign: 'center'
    }
});