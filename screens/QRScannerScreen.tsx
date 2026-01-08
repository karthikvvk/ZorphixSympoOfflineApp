import React, { useState } from 'react';
import { Text, View, StyleSheet, Button, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { getParticipantByUID, markCheckedIn } from '../services/sqlite';

type QRScannerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'QRScanner'>;

type Props = {
    navigation: QRScannerScreenNavigationProp;
};

export default function QRScannerScreen({ navigation }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    if (!permission) {
        // Camera permissions are still loading.
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.text}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="Grant Permission" color="#FFD700" />
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : async ({ type, data }) => {
                    setScanned(true);

                    try {
                        // 1. Check local SQLite DB
                        const participant = await getParticipantByUID(data); // data is the UID

                        if (!participant) {
                            Alert.alert("Not Registered", "No record found for this code.");
                            return;
                        }

                        // 2. Check if already verified
                        if (participant.checked_in === 1) {
                            Alert.alert(
                                "Already Verified",
                                `Participant: ${participant.name}\nSource: ${participant.source}\nStatus: Verified`
                            );
                            return;
                        }

                        // 3. Mark as checked in
                        markCheckedIn(participant.uid);
                        Alert.alert("Success", `Checked in: ${participant.name}`);

                    } catch (error) {
                        console.error(error);
                        Alert.alert("Error", "Failed to verify code.");
                    }
                }}
            />

            {scanned && (
                <View style={styles.overlay}>
                    <Button title={'Tap to Scan Again'} onPress={() => setScanned(false)} color="#FFD700" />
                </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
    },
    text: {
        color: '#FFD700',
        textAlign: 'center',
        fontSize: 18,
        marginBottom: 20
    },
    overlay: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 10,
        borderRadius: 5
    },
    closeText: {
        color: '#FFD700',
        fontWeight: 'bold'
    }
});