all:
	@echo "Doing all"

deploy:
	@echo "Install missing modules"
	@pwd
	@whoami
	@cd ../live/ 
	@npm install
	@echo "Restart server?"

update:
	@echo "Makefile: Doing UPDATE stuff like grunt, gulp, rake,..."
	@whoami
	@pwd
