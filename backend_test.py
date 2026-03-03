import requests
import sys
import json
from datetime import datetime

class OCRResumeAPITester:
    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.analysis_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=60)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.content:
                    try:
                        resp_data = response.json()
                        print(f"Response keys: {list(resp_data.keys()) if isinstance(resp_data, dict) else 'Non-dict response'}")
                        return True, resp_data
                    except:
                        return True, response.text
                return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )

    def test_analyze_text_valid(self):
        """Test analyze text with valid resume content"""
        sample_resume = """
        John Doe
        Software Engineer
        johndoe@example.com
        (555) 123-4567
        
        PROFESSIONAL SUMMARY
        Experienced software engineer with 5 years of experience in web development using JavaScript, Python, and React.
        
        WORK EXPERIENCE
        Senior Software Engineer - Tech Corp (2020-2023)
        - Developed and maintained web applications using React and Node.js
        - Led a team of 3 developers on key projects
        - Increased application performance by 40%
        
        Software Engineer - StartUp Inc (2018-2020)
        - Built REST APIs using Python and Flask
        - Implemented automated testing procedures
        - Collaborated with cross-functional teams
        
        EDUCATION
        Bachelor of Science in Computer Science
        State University (2014-2018)
        
        SKILLS
        - Programming Languages: Python, JavaScript, Java
        - Frameworks: React, Node.js, Flask
        - Databases: PostgreSQL, MongoDB
        - Tools: Git, Docker, AWS
        """
        
        success, response = self.run_test(
            "Analyze Resume Text",
            "POST",
            "analyze/text",
            200,
            data={"text": sample_resume, "analysis_type": "resume"}
        )
        
        if success and response:
            # Store analysis ID for later tests
            self.analysis_id = response.get('id')
            
            # Verify required fields
            required_fields = ['overall_score', 'ats_score', 'format_score', 'content_score', 'skills_score']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"⚠️  Warning - Missing score fields: {missing_fields}")
            else:
                print("✅ All score fields present")
                
            # Check score values
            scores = {field: response.get(field, 0) for field in required_fields if field in response}
            print(f"Scores: {scores}")
            
            # Check other fields
            other_fields = ['candidate_name', 'summary', 'strengths', 'improvements', 'skills']
            present_fields = [field for field in other_fields if response.get(field)]
            print(f"Present analysis fields: {present_fields}")
            
        return success, response

    def test_analyze_text_short(self):
        """Test analyze text with too short content - should fail"""
        return self.run_test(
            "Analyze Short Text (Should Fail)",
            "POST",
            "analyze/text",
            400,
            data={"text": "Too short", "analysis_type": "resume"}
        )

    def test_explain_document(self):
        """Test document explanation"""
        sample_text = """
        This is a software engineering resume for John Doe. He has experience with web development
        using modern technologies like React and Python. The candidate has leadership experience
        and has demonstrated quantifiable achievements in previous roles.
        """
        
        success, response = self.run_test(
            "Explain Document",
            "POST",
            "explain",
            200,
            data={"text": sample_text, "question": "What type of role is this person suitable for?"}
        )
        
        if success and response:
            expected_fields = ['explanation', 'key_points', 'document_type']
            missing_fields = [field for field in expected_fields if field not in response]
            if missing_fields:
                print(f"⚠️  Warning - Missing explanation fields: {missing_fields}")
            else:
                print("✅ All explanation fields present")
                print(f"Document type detected: {response.get('document_type')}")
                print(f"Key points count: {len(response.get('key_points', []))}")
        
        return success, response

    def test_explain_document_short(self):
        """Test explain document with too short content - should fail"""
        return self.run_test(
            "Explain Short Text (Should Fail)",
            "POST",
            "explain",
            400,
            data={"text": "Short"}
        )

    def test_get_analyses(self):
        """Test getting list of analyses"""
        return self.run_test(
            "Get Analyses List",
            "GET",
            "analyses",
            200
        )

    def test_get_analysis_by_id(self):
        """Test getting specific analysis by ID"""
        if not self.analysis_id:
            print("⚠️  Skipping - No analysis ID available")
            return True, {}
            
        return self.run_test(
            f"Get Analysis by ID ({self.analysis_id})",
            "GET",
            f"analyses/{self.analysis_id}",
            200
        )

    def test_delete_analysis(self):
        """Test deleting an analysis"""
        if not self.analysis_id:
            print("⚠️  Skipping - No analysis ID available")
            return True, {}
            
        return self.run_test(
            f"Delete Analysis ({self.analysis_id})",
            "DELETE",
            f"analyses/{self.analysis_id}",
            200
        )

def main():
    print("🚀 Starting OCR Resume Scanner API Tests")
    print("=" * 50)
    
    # Setup
    tester = OCRResumeAPITester()

    # Run tests in order
    test_methods = [
        tester.test_health_check,
        tester.test_root_endpoint,
        tester.test_analyze_text_valid,
        tester.test_analyze_text_short,
        tester.test_explain_document,
        tester.test_explain_document_short,
        tester.test_get_analyses,
        tester.test_get_analysis_by_id,
        tester.test_delete_analysis,
    ]

    for test_method in test_methods:
        try:
            test_method()
        except Exception as e:
            print(f"❌ Test {test_method.__name__} failed with exception: {e}")

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests Summary: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend API tests passed!")
        return 0
    else:
        print("⚠️  Some backend API tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())